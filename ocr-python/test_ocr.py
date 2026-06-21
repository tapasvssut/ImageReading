"""Quick end-to-end test for the OCR server."""
import io
import json
import urllib.request

from PIL import Image, ImageDraw

# Create a simple test image with text
img = Image.new("RGB", (400, 100), color="white")
draw = ImageDraw.Draw(img)
draw.text((10, 30), "Invoice Total: 100", fill="black")
buf = io.BytesIO()
img.save(buf, format="PNG")
buf.seek(0)
img_bytes = buf.read()

boundary = "testboundary123"
body = (
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="file"; filename="test.png"\r\n'
    f"Content-Type: image/png\r\n\r\n"
).encode() + img_bytes + f"\r\n--{boundary}--\r\n".encode()

req = urllib.request.Request(
    "http://127.0.0.1:8000/ocr",
    data=body,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
)

with urllib.request.urlopen(req, timeout=60) as r:
    print("HTTP Status:", r.status)
    resp = json.loads(r.read().decode())
    print("text          :", resp.get("text"))
    print("readProbability:", resp.get("readProbability"))
    print("status        :", resp.get("status"))
