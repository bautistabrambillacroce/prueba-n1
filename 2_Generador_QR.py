import streamlit as st
from embed import render

st.set_page_config(page_title="Generador QR", page_icon="🔳", layout="centered")
render("generator.html", height=1500)
