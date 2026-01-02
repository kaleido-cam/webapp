import subprocess

from flask import Flask, render_template, request, session, redirect, url_for, flash
from flask_socketio import SocketIO, emit
# from flask_htmx import HTMX
import requests
from wtforms import StringField
from wtforms.fields.simple import PasswordField
from wtforms.validators import DataRequired
import hmac

import config
from logging import basicConfig, getLogger, INFO
from flask_wtf import FlaskForm
from collections import Counter

from errors import ControlServerError
from functools import wraps

basicConfig(level=INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = getLogger(__name__)

app = Flask(__name__)
# htmx = HTMX(app)
socketio = SocketIO(app)

# Simple in-memory "database" for current state
db = {
    "current_brightness": 15,
    "current_frequency": 0,
    "connected_clients": Counter(),
}

app.config.update({
    "SECRET_KEY": config.SECRET_KEY,
})


def requires_capability(capability_name):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not session.get(f"has_capability_{capability_name}"):
                return redirect(url_for('enable_capability', capability=capability_name, next=request.path))
            return f(*args, **kwargs)

        return decorated_function

    return decorator


def get_enabled_capabilities():
    """Retrieve the list of enabled capabilities for the current session."""
    available_capabilities = list(config.CAPABILITY_TOKENS.keys())
    enabled_capabilities = [
        cap for cap in available_capabilities if session.get(f"has_capability_{cap}")
    ]
    return enabled_capabilities


@app.route("/")
def index():
    stream_url = f"{config.STREAM_BASE_URL}/kaleido-01/kaleidoscope/whep"
    return render_template(
        "index.html",
        current_brightness=db["current_brightness"],
        current_frequency=db["current_frequency"],
        stream_url=stream_url,
        frequency_limit=2000,
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
    return redirect(url_for("index"))


class UpdateSystemForm(FlaskForm):
    component = StringField("Component", validators=[DataRequired()])


def get_webapp_version() -> str:
    try:
        result = subprocess.run(["git", "rev-parse", "HEAD"], check=True, capture_output=True, text=True)
        commit_hash = result.stdout.strip()
        return commit_hash
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to get git commit hash: {e}")
        return "unknown"

def update_webapp() -> bool:
    previous_hash = get_webapp_version()
    subprocess.run(["git", "pull"], check=True)
    new_hash = get_webapp_version()

    if previous_hash == new_hash:
        # No new version available
        return False

    # Restart with a slight delay, so the response can be sent before the server goes down
    subprocess.Popen(["/bin/sh", "-c", "sleep 2 && sudo systemctl restart kaleido-webapp.service"])
    return True

def get_kaleido_hardware_version(hardware_id) -> str:
    try:
        res = requests.get(f"{config.CONTROL_SERVER_BASE_URL}/system/version", timeout=2)
    except requests.RequestException:
        return "offline"
    if res.status_code == 200:
        return res.json().get("commit_hash", "unknown")
    return "unknown"

def update_kaleido_hardware(hardware_id) -> bool:
    try:
        res = requests.post(f"{config.CONTROL_SERVER_BASE_URL}/system/update", timeout=2)
        res.raise_for_status()
        return True
    except requests.RequestException:
        logger.exception(f"Failed to update kaleido hardware {hardware_id}")
        return False

@app.route("/update-system", methods=["GET", "POST"])
@requires_capability(capability_name="update_system")
def update_system():
    form = UpdateSystemForm()
    if form.validate_on_submit():
        component = request.form.get("component")
        if component == "webapp":
            if update_webapp():
                flash("Webapp updated successfully and will restart shortly", "success")
            else:
                flash("No new version available")
        elif component.startswith("kaleido."):
            if update_kaleido_hardware(component):
                flash(f"{component} updated successfully", "success")
            else:
                flash(f"Failed to update {component}", "error")
        return redirect(url_for("update_system"))

    kaleidoscopes = [
        {
            "id": "1",
            "name": "Kaleidoscope 01",
            "current_version": get_kaleido_hardware_version("kaleido-01"),
        }
    ]

    return render_template(
        "system_update.html",
        form=form,
        current_webapp_version=get_webapp_version(),
        kaleidoscopes=kaleidoscopes,
    )


class EnableCapabilityForm(FlaskForm):
    token = PasswordField("Token", validators=[DataRequired()])


@app.context_processor
def inject_user():
    return dict(
        user={
            "capabilities": get_enabled_capabilities(),
        }
    )


@app.route("/capabilities", methods=["GET", "POST"])
def list_capabilities():
    if request.method == "POST":
        if capability := request.form.get("revoke"):
            session.pop(f"has_capability_{capability}", None)
            flash(f'Capability "{capability}" has been revoked.', "success")
            return redirect(url_for("list_capabilities"))

    return render_template("capabilities/list.html", )


@app.route("/capability/<capability>", methods=["GET", "POST"])
def enable_capability(capability: str):
    next_page = request.args.get("next")
    if not config.CAPABILITY_TOKENS.get(capability):
        flash(f'Capability "{capability}" is not available.', "error")
        return redirect(url_for("index"))
    if session.get(f"has_capability_{capability}"):
        return redirect(next_page or url_for("index"))
    form = EnableCapabilityForm()
    if form.validate_on_submit():
        token = form.token.data
        if hmac.compare_digest(token, config.CAPABILITY_TOKENS[capability]):
            session[f"has_capability_{capability}"] = True
            flash(f'Capability "{capability}" enabled successfully.', "success")
            return redirect(next_page or url_for("index"))
        else:
            form.token.errors.append("Invalid token")
    return render_template("capabilities/enable.html", form=form, capability=capability, next=next_page)


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


@socketio.on('connect')
def ws_handle_connect():
    client_ip = request.remote_addr
    db["connected_clients"][client_ip] += 1
    socketio.emit('connected_clients', db["connected_clients"].total())

    if db["connected_clients"].total() == 1:
        wakeup()


@socketio.on('disconnect')
def ws_handle_disconnect():
    client_ip = request.remote_addr
    db["connected_clients"][client_ip] -= 1
    if db["connected_clients"][client_ip] < 0:
        logger.error(f"Negative client count for IP {client_ip}")
    if db["connected_clients"][client_ip] <= 0:
        del db["connected_clients"][client_ip]
    socketio.emit('connected_clients', db["connected_clients"].total())

    if db["connected_clients"].total() == 0:
        standby_mode()


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


@socketio.on('get_current_state')
def ws_handle_get_current_state():
    emit('current_brightness', db["current_brightness"])
    emit('current_frequency', db["current_frequency"])
    emit('connected_clients', db["connected_clients"].total())


def standby_mode():
    change_light_brightness(0)
    change_motor_frequency(0)


def wakeup():
    change_light_brightness(15)


# change_light_brightness(15)
# change_motor_frequency(0)

if __name__ == "__main__":
    socketio.run(app)
