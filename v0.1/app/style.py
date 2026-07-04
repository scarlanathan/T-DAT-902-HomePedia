import streamlit as st

def apply_style():
    st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap');

    * { font-family: 'Inter', sans-serif; }

    .stApp { background: #f8f8f6; }

    [data-testid="stSidebar"] {
        background: #ffffff;
        border-right: 1px solid #eeeeee;
    }
    [data-testid="stSidebar"] * { color: #1c1c1c !important; }
    [data-testid="stSidebarNav"] a {
        border-radius: 10px;
        padding: 0.5rem 1rem;
        margin: 2px 8px;
    }
    [data-testid="stSidebarNav"] a:hover {
        background: #fff5f0 !important;
        color: #ff6b2b !important;
    }
    [data-testid="stSidebarNav"] a[aria-selected="true"] {
        background: #fff5f0 !important;
        border-left: 3px solid #ff6b2b;
        color: #ff6b2b !important;
    }

    .main .block-container {
        padding: 2rem 3rem;
        max-width: 1400px;
    }

    h1, h2, h3 {
        color: #1c1c1c !important;
        font-weight: 700;
    }

    p { color: #555555; }

    [data-testid="metric-container"] {
        background: #ffffff;
        border: none;
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        border-top: 4px solid #ff6b2b;
    }
    [data-testid="metric-container"] label {
        color: #999999 !important;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 600;
    }
    [data-testid="metric-container"] [data-testid="stMetricValue"] {
        color: #1c1c1c !important;
        font-weight: 800;
        font-size: 1.8rem;
    }
    [data-testid="metric-container"] [data-testid="stMetricDelta"] {
        color: #ff6b2b !important;
        font-weight: 500;
    }

    .stSelectbox label, .stRadio label,
    .stMultiSelect label, .stTextInput label,
    .stTextArea label {
        color: #555555 !important;
        font-weight: 600;
        font-size: 0.85rem;
    }
    .stSelectbox div[data-baseweb="select"] {
        background: #ffffff !important;
        border: 1px solid #e0e0e0 !important;
        border-radius: 10px !important;
    }
    .stTextInput input, .stTextArea textarea {
        background: #ffffff !important;
        border: 1px solid #e0e0e0 !important;
        border-radius: 10px !important;
        color: #1c1c1c !important;
    }
    .stTextInput input:focus, .stTextArea textarea:focus {
        border-color: #ff6b2b !important;
        box-shadow: 0 0 0 3px rgba(255,107,43,0.1) !important;
    }

    .stButton button {
        background: linear-gradient(135deg, #ff6b2b, #ff8c55);
        color: white;
        border: none;
        border-radius: 10px;
        font-weight: 600;
        padding: 0.5rem 2rem;
        box-shadow: 0 4px 15px rgba(255,107,43,0.3);
        transition: all 0.3s;
    }
    .stButton button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(255,107,43,0.4);
    }

    .stDataFrame {
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        border: none;
    }

    hr { border-color: #eeeeee !important; }

    .stAlert {
        border-radius: 10px !important;
    }
</style>
""", unsafe_allow_html=True)