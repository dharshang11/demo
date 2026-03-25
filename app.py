from flask import Flask, render_template, request
from scanner import scan_ports

app = Flask(__name__)

@app.route("/", methods=["GET", "POST"])
def index():
    results = None

    if request.method == "POST":
        host = request.form["host"]
        start_port = int(request.form["start_port"])
        end_port = int(request.form["end_port"])

        open_ports = scan_ports(host, start_port, end_port)
        results = open_ports

    return render_template("index.html", results=results)

if __name__ == "__main__":
    app.run(debug=True)