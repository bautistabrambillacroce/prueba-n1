import streamlit as st
from embed import render

st.set_page_config(page_title="Búsqueda del tesoro", page_icon="🧭", layout="centered")
st.markdown("<style>header,footer,#MainMenu{visibility:hidden}.block-container{padding:.5rem}</style>",
            unsafe_allow_html=True)
render("index.html", height=1400)
