from flask import Flask, render_template, request
from flask.cli import load_dotenv
from flask_htmx import HTMX
import os
import requests
from logging import basicConfig, getLogger, INFO

load_dotenv()

basicConfig(level=INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = getLogger(__name__)

DATABASE = ":memory:"
CONTROL_SERVER_BASE_URL = os.getenv("CONTROL_SERVER_BASE_URL", "http://172.16.33.3:8000")
STREAM_BASE_URL = os.getenv("STREAM_BASE_URL", "https://stream.kaleido.cam")
app = Flask(__name__)
htmx = HTMX(app)


@app.route("/")
def index():
    # TODO: read current brightness and frequency from application state
    current_brightness = 15
    current_frequency = 200
    stream_url = f"{STREAM_BASE_URL}/kaleido-01/kaleidoscope/whep"
    return render_template("index.html",
                           current_brightness=current_brightness,
                           current_frequency=current_frequency,
                           stream_url=stream_url
                           )


@app.route("/api/state", methods=["GET", "POST"])
def state():
    if request.method == "POST":
        brightness = request.json.get("brightness", None)
        frequency = request.json.get("frequency", None)
        if brightness is not None:
            brightness = int(brightness)
            # Control server allows 100, but that produces excessive heat
            if brightness < 0 or brightness > 50:
                return {"error": "Brightness must be between 0 and 50"}, 400
            try:
                resp = requests.post(f"{CONTROL_SERVER_BASE_URL}/hardware/light", json={"brightness": brightness})
                resp.raise_for_status()
            except requests.RequestException:
                logger.exception("Failed to set brightness")
                return {"error": "Unable to reach kaleido hardware. Please try again later."}, 500
        if frequency is not None:
            frequency = int(frequency)
            if frequency < -2000 or frequency > 2000:
                return {"error": "Frequency must be between -2000 and 2000"}, 400
            try:
                resp = requests.post(f"{CONTROL_SERVER_BASE_URL}/hardware/motor", json={"frequency": frequency})
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
