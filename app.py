from flask import Flask, render_template, request, session, redirect, url_for, flash
# from flask_htmx import HTMX
import requests
from wtforms import StringField
from wtforms.validators import DataRequired
import hmac

import config
from logging import basicConfig, getLogger, INFO
from flask_wtf import FlaskForm

basicConfig(level=INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = getLogger(__name__)

app = Flask(__name__)
# htmx = HTMX(app)

app.config.update({
    "SECRET_KEY": config.SECRET_KEY,
})


@app.route("/")
def index():
    # TODO: read current brightness and frequency from application state
    current_brightness = 15
    current_frequency = 200
    stream_url = f"{config.STREAM_BASE_URL}/kaleido-01/kaleidoscope/whep"
    return render_template("index.html",
                           current_brightness=current_brightness,
                           current_frequency=current_frequency,
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
            brightness = int(brightness)
            # Control server allows 100, but that produces excessive heat
            if brightness < 0 or brightness > 50:
                return {
                    "error": "INVALID_BRIGHTNESS_RANGE",
                    "message": "Brightness must be between 0 and 50",
                }, 400
            try:
                resp = requests.post(f"{config.CONTROL_SERVER_BASE_URL}/hardware/light",
                                     json={"brightness": brightness})
                resp.raise_for_status()
            except requests.RequestException:
                logger.exception("Failed to set brightness")
                return {"error": "Unable to reach kaleido hardware. Please try again later."}, 500
        if frequency is not None:
            frequency = int(frequency)
            if frequency < -2000 or frequency > 2000:
                return {
                    "error": "INVALID_FREQUENCY_RANGE",
                    "message": "Frequency must be between -2000 and 2000",
                }, 400
            try:
                resp = requests.post(f"{config.CONTROL_SERVER_BASE_URL}/hardware/motor", json={"frequency": frequency})
                resp.raise_for_status()
            except requests.RequestException:
                logger.exception("Failed to set motor frequency")
                return {"error": "Unable to reach kaleido hardware. Please try again later."}, 500
        # TODO: persist brightness and frequency to application state. Return brightness and frequency as confirmation
        return {"status": "success"}, 200
    elif request.method == "GET":
        # TODO: return current brightness and frequency from application state
        current_brightness = 15
        current_frequency = 200
        return {
            "brightness": current_brightness,
            "frequency": current_frequency
        }, 200


if __name__ == "__main__":
    app.run()
