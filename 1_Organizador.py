import streamlit as st
from embed import render

st.set_page_config(page_title="Organizador", page_icon="🛠️", layout="centered")
render("admin.html", height=1500)
