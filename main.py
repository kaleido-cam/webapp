from flask import Flask, render_template, request, session, redirect, url_for, flash
from flask_socketio import SocketIO, emit
# from flask_htmx import HTMX
import requests
from wtforms import StringField
from wtforms.validators import DataRequired
import hmac

import config
from logging import basicConfig, getLogger, INFO
from flask_wtf import FlaskForm

from errors import ControlServerError

basicConfig(level=INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = getLogger(__name__)

app = Flask(__name__)
# htmx = HTMX(app)
socketio = SocketIO(app)

# Simple in-memory "database" for current state
db = {
    "current_brightness": 15,
    "current_frequency": 0,
}

app.config.update({
    "SECRET_KEY": config.SECRET_KEY,
})


@app.route("/")
def index():
    stream_url = f"{config.STREAM_BASE_URL}/kaleido-01/kaleidoscope/whep"
    return render_template(
        "index.html",
        current_brightness=db["current_brightness"],
        current_frequency=db["current_frequency"],
        stream_url=stream_url,
        frequency_step=5,
    )


@app.route("/controls")
def controls():
    return render_template(
        "controls.html",
        current_brightness=db["current_brightness"],
        current_frequency=db["current_frequency"],
        frequency_limit=2000,
        frequency_step=1,
    )


@app.route("/stream")
def stream():
    stream_url = f"{config.STREAM_BASE_URL}/kaleido-01/kaleidoscope/whep"
    return render_template("stream.html",
                           stream_url=stream_url
                           )


class VoucherLoginForm(FlaskForm):
    token = StringField("Token", validators=[DataRequired()])


@app.route("/voucher/login", methods=["GET", "POST"])
def voucher_login():
    if not config.VOUCHER_LOGIN_TOKEN:
        flash("Voucher login is not configured.", "error")
        return redirect(url_for("index"))
    if session.get("can_create_voucher"):
        return redirect(url_for("create_voucher"))
    form = VoucherLoginForm()
    if form.validate_on_submit():
        token = form.token.data
        if hmac.compare_digest(token, config.VOUCHER_LOGIN_TOKEN):
            session["can_create_voucher"] = True
            return redirect(url_for("create_voucher"))
        else:
            form.token.errors.append("Invalid token")
    return render_template("voucher/login.html", form=form)


@app.route("/voucher/create", methods=["GET", "POST"])
def create_voucher():
    if not session.get("can_create_voucher"):
        return redirect(url_for("voucher_login"))
    # if request.method == "GET":
    #
    return render_template("voucher/create.html")


@app.route("/voucher/redeem", methods=["GET", "POST"])
@app.route("/voucher/redeem/<voucher_code>", methods=["GET", "POST"])
def redeem_voucher(voucher_code=None):
    return render_template("voucher/redeem.html")


@app.route("/api/state", methods=["GET", "POST"])
def state():
    if request.method == "POST":
        # if not session.get("can_control.... date from to..."):
        #     return {"error": "permission denied"}, 403
        brightness = request.json.get("brightness", None)
        frequency = request.json.get("frequency", None)
        if brightness is not None:
            try:
                change_light_brightness(brightness)
            except ValueError as ve:
                return {
                    "error": "INVALID_BRIGHTNESS_RANGE",
                    "message": str(ve),
                }, 400
            except ControlServerError as e:
                return {"error": "HARDWARE_FAILURE", "message": str(e)}, 500
        if frequency is not None:
            try:
                change_motor_frequency(frequency)
            except ValueError as ve:
                return {
                    "error": "INVALID_FREQUENCY_RANGE",
                    "message": str(ve),
                }, 400
            except ControlServerError as e:
                return {"error": "HARDWARE_FAILURE", "message": str(e)}, 500
        return {
            "status": "success",
            "brightness": db["current_brightness"],
            "frequency": db["current_frequency"]
        }, 200
    elif request.method == "GET":
        return {
            "brightness": db["current_brightness"],
            "frequency": db["current_frequency"]
        }, 200


def change_motor_frequency(frequency):
    frequency = int(frequency)
    if frequency < -2000 or frequency > 2000:
        raise ValueError("Frequency must be between -2000 and 2000")

    try:
        resp = requests.post(f"{config.CONTROL_SERVER_BASE_URL}/hardware/motor", json={"frequency": frequency})
        resp.raise_for_status()
    except (requests.RequestException, requests.ConnectionError):
        logger.exception("Failed to set motor frequency")
        raise ControlServerError("Unable to reach kaleido hardware. Please try again later.")
    socketio.emit('current_frequency', frequency)
    db["current_frequency"] = frequency


def change_light_brightness(brightness):
    brightness = int(brightness)
    # Control server allows 100, but that produces excessive heat
    if brightness < 0 or brightness > 50:
        raise ValueError("Brightness must be between 0 and 50")

    try:
        resp = requests.post(f"{config.CONTROL_SERVER_BASE_URL}/hardware/light",
                             json={"brightness": brightness})
        resp.raise_for_status()
    except requests.RequestException:
        logger.exception("Failed to set brightness")
        raise ControlServerError("Unable to reach kaleido hardware. Please try again later.")
    socketio.emit('current_brightness', brightness)
    db["current_brightness"] = brightness


@socketio.on('frequency')
def ws_handle_frequency(value):
    try:
        change_motor_frequency(value)
    except ValueError as e:
        emit('error', {'error': 'INVALID_FREQUENCY_RANGE', 'message': str(e)})
    except ControlServerError as e:
        emit('error', {'error': 'HARDWARE_FAILURE', 'message': str(e)})


@socketio.on('brightness')
def ws_handle_brightness(value):
    try:
        change_light_brightness(value)
    except ValueError as e:
        emit('error', {'error': 'INVALID_BRIGHTNESS_RANGE', 'message': str(e)})
    except ControlServerError as e:
        emit('error', {'error': 'HARDWARE_FAILURE', 'message': str(e)})


# change_light_brightness(15)
# change_motor_frequency(0)

if __name__ == "__main__":
    socketio.run(app)
