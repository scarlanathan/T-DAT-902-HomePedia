import streamlit as st
import pandas as pd
import plotly.express as px
import sys
sys.path.append("app")
from style import apply_style

st.set_page_config(
    page_title="Homepedia",
    page_icon="🏡",
    layout="wide",
    initial_sidebar_state="expanded"
)

apply_style()

st.markdown("""
<div style="
    background: linear-gradient(135deg, #ff6b2b 0%, #ffb347 100%);
    padding: 2rem 3rem;
    border-radius: 20px;
    margin-bottom: 2rem;
    box-shadow: 0 8px 30px rgba(255,107,43,0.2);
    display: flex;
    align-items: center;
    justify-content: space-between;
">
    <div>
        <div style="
            display: inline-block;
            background: rgba(255,255,255,0.25);
            padding: 0.25rem 0.9rem;
            border-radius: 50px;
            color: white;
            font-size: 0.7rem;
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 0.8rem;
        ">Marche Immobilier Francais 2023</div>
        <h1 style="
            color: white;
            font-size: 2.8rem;
            font-weight: 900;
            margin: 0;
            letter-spacing: -1px;
        ">🏡 Homepedia</h1>
        <p style="
            color: rgba(255,255,255,0.85);
            font-size: 1rem;
            margin: 0.5rem 0 0;
            font-weight: 300;
        ">La plateforme de reference pour explorer le marche immobilier francais</p>
    </div>
    <div style="font-size: 5rem; opacity: 0.2;">🏠</div>
</div>
""", unsafe_allow_html=True)

@st.cache_data
def load_stats():
    dept = pd.read_csv("data/cleaned/stats_departement_complet.csv")
    villes = pd.read_csv("data/cleaned/spark_prix_ville.csv")
    return dept, villes

dept, villes = load_stats()

col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Transactions analysees", f"{dept['nb_transactions'].sum():,}", "Annee 2023")
with col2:
    st.metric("Prix m2 moyen", f"{dept['prix_m2_moyen'].mean():.0f} €", "National")
with col3:
    st.metric("Departements", len(dept), "France entiere")
with col4:
    st.metric("Villes", f"{len(villes):,}", "Min 5 transactions")

st.markdown("---")

col1, col2 = st.columns(2)

with col1:
    st.subheader("Top 10 departements les plus chers")
    top10 = dept.nlargest(10, "prix_m2_moyen")
    fig = px.bar(
        top10,
        x="code_departement",
        y="prix_m2_moyen",
        color="prix_m2_moyen",
        color_continuous_scale=["#ffb347", "#ff6b2b"],
        text="prix_m2_moyen",
        labels={"prix_m2_moyen": "Prix m2 (€)", "code_departement": "Departement"}
    )
    fig.update_traces(texttemplate="%{text:.0f}€", textposition="outside")
    fig.update_layout(
        showlegend=False,
        plot_bgcolor="white",
        paper_bgcolor="white",
        coloraxis_showscale=False,
        font_color="#1c1c1c",
        xaxis=dict(gridcolor="#f0f0f0"),
        yaxis=dict(gridcolor="#f0f0f0"),
        margin=dict(t=30, b=20),
        height=350
    )
    st.plotly_chart(fig, use_container_width=True)

with col2:
    st.subheader("Top 10 departements les moins chers")
    bottom10 = dept.nsmallest(10, "prix_m2_moyen")
    fig = px.bar(
        bottom10,
        x="code_departement",
        y="prix_m2_moyen",
        color="prix_m2_moyen",
        color_continuous_scale=["#ff6b2b", "#ffb347"],
        text="prix_m2_moyen",
        labels={"prix_m2_moyen": "Prix m2 (€)", "code_departement": "Departement"}
    )
    fig.update_traces(texttemplate="%{text:.0f}€", textposition="outside")
    fig.update_layout(
        showlegend=False,
        plot_bgcolor="white",
        paper_bgcolor="white",
        coloraxis_showscale=False,
        font_color="#1c1c1c",
        xaxis=dict(gridcolor="#f0f0f0"),
        yaxis=dict(gridcolor="#f0f0f0"),
        margin=dict(t=30, b=20),
        height=350
    )
    st.plotly_chart(fig, use_container_width=True)

st.markdown("---")
st.subheader("Population vs Prix m2 par departement")
fig = px.scatter(
    dept.dropna(subset=["population", "prix_m2_moyen"]),
    x="population",
    y="prix_m2_moyen",
    size="nb_transactions",
    color="prix_m2_moyen",
    hover_name="nom_departement",
    color_continuous_scale=["#ffb347", "#ff6b2b"],
    labels={
        "population": "Population",
        "prix_m2_moyen": "Prix m2 moyen (€)",
        "nom_departement": "Departement"
    }
)
fig.update_layout(
    plot_bgcolor="white",
    paper_bgcolor="white",
    font_color="#1c1c1c",
    coloraxis_showscale=False,
    xaxis=dict(gridcolor="#f0f0f0"),
    yaxis=dict(gridcolor="#f0f0f0"),
    height=400,
    margin=dict(t=20)
)
st.plotly_chart(fig, use_container_width=True)

st.markdown("""
<div style="
    text-align: center;
    color: #aaaaaa;
    font-size: 0.8rem;
    padding: 1.5rem 0 0.5rem;
    border-top: 1px solid #eeeeee;
    margin-top: 1rem;
">
    <strong style="color: #ff6b2b;">Homepedia</strong> -
    Donnees DVF 2023 - 1 066 032 transactions - Epitech
</div>
""", unsafe_allow_html=True)