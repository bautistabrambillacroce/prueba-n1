"""Embebe las páginas estáticas de docs/ dentro de Streamlit.

Streamlit renderiza el HTML en un iframe (srcdoc), por eso CSS, config y JS se
inlinean. Las claves de Supabase salen de st.secrets (o de docs/config.js).
La validación sigue ocurriendo en Supabase: Streamlit solo sirve la interfaz.
"""
import json
from pathlib import Path

DOCS = Path(__file__).parent / "docs"


def _safe(s: str) -> str:
    return s.replace("</", "<\\/")


def build_html(page: str, url: str | None = None, key: str | None = None) -> str:
    html = (DOCS / page).read_text(encoding="utf-8")
    css = (DOCS / "style.css").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="style.css">', f"<style>{css}</style>")
    if url and key:
        cfg = "window.CFG = " + _safe(json.dumps({"SUPABASE_URL": url, "SUPABASE_ANON_KEY": key})) + ";"
    else:
        cfg = (DOCS / "config.js").read_text(encoding="utf-8")
    html = html.replace('<script src="config.js"></script>', f"<script>{cfg}</script>")
    if 'src="app.js"' in html:
        app = (DOCS / "app.js").read_text(encoding="utf-8")
        html = html.replace('<script src="app.js"></script>', f"<script>{_safe(app)}</script>")
    # los links entre páginas no existen dentro del iframe
    html = html.replace('<a href="generator.html">generator.html</a>', "la página «Generador QR»")
    return html


def render(page: str, height: int = 1300) -> None:
    import streamlit as st
    import streamlit.components.v1 as components

    try:
        url, key = st.secrets["SUPABASE_URL"], st.secrets["SUPABASE_ANON_KEY"]
    except Exception:
        url = key = None
    components.html(build_html(page, url, key), height=height, scrolling=True)
