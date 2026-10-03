"""Package the standalone HTML app into a self-contained Jupyter / Google Colab notebook.

The notebook embeds the exact HTML (zlib-compressed and base64-encoded), checks its
SHA-256 before use and displays it in a sandboxed iframe, so the local and notebook
editions always run the same app.

Usage:
    python make_notebook.py [input.html] [output.ipynb]

Defaults: dist/FCC-Explorer.html -> dist/FCC-Explorer-Colab.ipynb
Only the Python standard library is needed.
"""

import base64
import hashlib
import json
import sys
import zlib
from pathlib import Path

INTRO = """\
# FCC Crystallography Explorer

An interactive textbook, 3D crystal viewer, analytic 2D surface net, and calculator.

**Colab:** upload this `.ipynb` using **File → Upload notebook**, then choose **Runtime → Run all**. A CPU runtime is enough. No package installation, API key, tunnel, Drive access, or GPU is required. Expand the output if your display is narrow; the learning panel moves below the viewer on narrow screens.

**Local Jupyter:** open this notebook and run its cells. Alternatively download the offline HTML using the final cell and open it in a modern browser.

Start with **Guided tour**. Use **Learn / Calculate / Verify / Layers** to connect the picture with its mathematics. All geometry is calculated in your browser. The application is MIT licensed and uses the MIT-licensed Three.js library; Google Colab is an optional hosted service, not an open-source dependency.

The app needs JavaScript and WebGL2 for 3D. Some notebook viewers suppress active output until you trust/run the notebook. If inline 3D is blocked, use the final cell to download the standalone HTML.
"""

EMBED = """\
import base64, hashlib, zlib

# Exact same self-contained HTML as the local edition.
FCC_APP_HTML = zlib.decompress(base64.b64decode(
    "{payload}"
)).decode("utf-8")
assert hashlib.sha256(FCC_APP_HTML.encode()).hexdigest() == "{digest}"
print("FCC Explorer is ready. Run the next cell to display it.")
"""

LAUNCH_HELP = """\
## Launch the explorer
The output is an interactive application. Save view downloads your settings; nothing is automatically uploaded by the app.
"""

LAUNCH = """\
from IPython.display import HTML, display
import html
import warnings

FCC_IFRAME = (
    '<iframe title="FCC Crystallography Explorer" '
    'style="width:100%;height:1120px;border:1px solid #dce6eb;border-radius:8px" '
    'sandbox="allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox" '
    'allowfullscreen srcdoc="' + html.escape(FCC_APP_HTML, quote=True) + '"></iframe>'
)
with warnings.catch_warnings():
    warnings.filterwarnings('ignore', message='Consider using IPython.display.IFrame instead')
    display(HTML(FCC_IFRAME))
"""

DOWNLOAD_HELP = """\
## Optional: download the standalone local version
This writes the same HTML to the notebook runtime and offers it as a download. It runs offline after download. XYZ, CIF and POSCAR exports inside the app always describe the configured **ideal bulk FCC supercell**, not an HCP comparison, defect stack, reciprocal view or set of ghost atoms.
"""

DOWNLOAD = """\
from pathlib import Path
offline_file = Path('FCC-Explorer.html')
offline_file.write_text(FCC_APP_HTML, encoding='utf-8')
try:
    from google.colab import files
except ImportError:
    from IPython.display import FileLink
    display(FileLink(str(offline_file)))
else:
    files.download(str(offline_file))
"""


def lines(text):
    """Notebook JSON stores source as a list of lines that keep their newline."""
    return text.splitlines(keepends=True)


def markdown(cell_id, text):
    return {"cell_type": "markdown", "id": cell_id, "metadata": {}, "source": lines(text)}


def code(cell_id, text, metadata=None):
    return {
        "cell_type": "code",
        "id": cell_id,
        "metadata": metadata or {},
        "source": lines(text),
        "execution_count": None,
        "outputs": [],
    }


def build_notebook(html: bytes) -> dict:
    digest = hashlib.sha256(html).hexdigest()
    payload = base64.b64encode(zlib.compress(html, 9)).decode("ascii")
    hidden = {"cellView": "form", "jupyter": {"source_hidden": True}}
    return {
        "nbformat": 4,
        "nbformat_minor": 5,
        "metadata": {
            "kernelspec": {"name": "python3", "display_name": "Python 3", "language": "python"},
            "language_info": {"name": "python"},
            "colab": {"name": "FCC-Explorer-Colab.ipynb"},
            "fcc_app_sha256": digest,
        },
        "cells": [
            markdown("intro", INTRO),
            code("embedded-app", EMBED.format(payload=payload, digest=digest), hidden),
            markdown("launch-help", LAUNCH_HELP),
            code("launch", LAUNCH),
            markdown("download-help", DOWNLOAD_HELP),
            code("download", DOWNLOAD),
        ],
    }


def main(argv):
    source = Path(argv[1] if len(argv) > 1 else "dist/FCC-Explorer.html")
    target = Path(argv[2] if len(argv) > 2 else source.with_name("FCC-Explorer-Colab.ipynb"))
    html = source.read_bytes()
    notebook = build_notebook(html)

    # Self-check: the embedded payload must decode to the exact input.
    embedded = "".join(notebook["cells"][1]["source"]).split('"')[1]
    if zlib.decompress(base64.b64decode(embedded)) != html:
        raise SystemExit("Embedded payload does not round-trip.")

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(notebook, indent=1, ensure_ascii=True), encoding="utf-8")
    print(f"Wrote {target} (embedded app SHA-256 {notebook['metadata']['fcc_app_sha256']})")


if __name__ == "__main__":
    main(sys.argv)
