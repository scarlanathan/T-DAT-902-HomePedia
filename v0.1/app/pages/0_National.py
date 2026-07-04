import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import sys
sys.path.append("app")
from style import apply_style

st.set_page_config(page_title="Vue Nationale - Homepedia", layout="wide")
apply_style()

st.markdown("""
<div style="
    background: linear-gradient(135deg, #ff6b2b 0%, #ffb347 100%);
    padding: 1.5rem 2rem;
    border-radius: 16px;
    margin-bottom: 1.5rem;
">
    <h1 style="color:white; margin:0; font-size:2rem;">Vue Nationale</h1>
    <p style="color:rgba(255,255,255,0.85); margin:0.3rem 0 0;">Synthese du marche immobilier francais 2023</p>
</div>
""", unsafe_allow_html=True)

@st.cache_data
def load_data():
    dept = pd.read_csv("data/cleaned/stats_departement_complet.csv")
    villes = pd.read_csv("data/cleaned/spark_prix_ville.csv")
    regions = pd.read_csv("data/cleaned/stats_region.csv")
    types = pd.read_csv("data/cleaned/spark_type_bien.csv")
    dept["code_departement"] = dept["code_departement"].astype(str)
    return dept, villes, regions, types

dept, villes, regions, types = load_data()

# METRIQUES NATIONALES
st.subheader("Chiffres cles nationaux")
col1, col2, col3, col4, col5 = st.columns(5)
col1.metric("Transactions 2023", f"{dept['nb_transactions'].sum():,}")
col2.metric("Prix m2 moyen", f"{dept['prix_m2_moyen'].mean():.0f} €")
col3.metric("Prix median national", f"{dept['prix_m2_median'].mean():.0f} €")
col4.metric("Surface moyenne", f"{dept['surface_moyenne'].mean():.0f} m2")
col5.metric("Prix moyen vente", f"{dept['prix_moyen'].mean():,.0f} €")

st.markdown("---")

# REPARTITION NATIONALE
col1, col2 = st.columns(2)

with col1:
    st.subheader("Repartition des transactions par region")
    fig = px.pie(
        regions,
        values="nb_transactions",
        names="nom_region",
        color_discrete_sequence=px.colors.sequential.Oranges_r,
        hole=0.4
    )
    fig.update_layout(
        plot_bgcolor="white",
        paper_bgcolor="white",
        height=400,
        showlegend=True
    )
    st.plotly_chart(fig, use_container_width=True)

with col2:
    st.subheader("Prix m2 moyen par region")
    fig = px.bar(
        regions.sort_values("prix_m2_moyen", ascending=True),
        x="prix_m2_moyen",
        y="nom_region",
        orientation="h",
        color="prix_m2_moyen",
        color_continuous_scale=["#ffb347", "#ff6b2b"],
        text="prix_m2_moyen",
        labels={"prix_m2_moyen": "Prix m2 (€)", "nom_region": "Region"}
    )
    fig.update_traces(texttemplate="%{text:.0f}€", textposition="outside")
    fig.update_layout(
        showlegend=False,
        plot_bgcolor="white",
        paper_bgcolor="white",
        coloraxis_showscale=False,
        height=400
    )
    st.plotly_chart(fig, use_container_width=True)

st.markdown("---")

# MAISONS VS APPARTEMENTS NATIONAL
st.subheader("Maisons vs Appartements - Vue nationale")
national_types = types.groupby("type_local").agg(
    nb_transactions=("nb_transactions", "sum"),
    prix_m2_moyen=("prix_m2_moyen", "mean")
).reset_index()

col1, col2, col3, col4 = st.columns(4)
maisons = national_types[national_types["type_local"] == "Maison"]
apparts = national_types[national_types["type_local"] == "Appartement"]

if len(maisons) > 0:
    col1.metric("Transactions maisons", f"{maisons['nb_transactions'].values[0]:,}")
    col2.metric("Prix m2 moyen maisons", f"{maisons['prix_m2_moyen'].values[0]:.0f} €")
if len(apparts) > 0:
    col3.metric("Transactions appartements", f"{apparts['nb_transactions'].values[0]:,}")
    col4.metric("Prix m2 moyen appartements", f"{apparts['prix_m2_moyen'].values[0]:.0f} €")

col1, col2 = st.columns(2)
with col1:
    fig = px.pie(
        national_types,
        values="nb_transactions",
        names="type_local",
        color_discrete_sequence=["#ff6b2b", "#ffb347"],
        title="Repartition maisons vs appartements",
        hole=0.4
    )
    fig.update_layout(plot_bgcolor="white", paper_bgcolor="white", height=350)
    st.plotly_chart(fig, use_container_width=True)

with col2:
    fig = px.bar(
        national_types,
        x="type_local",
        y="prix_m2_moyen",
        color="type_local",
        color_discrete_sequence=["#ff6b2b", "#ffb347"],
        text="prix_m2_moyen",
        title="Prix m2 moyen par type de bien",
        labels={"prix_m2_moyen": "Prix m2 (€)", "type_local": "Type"}
    )
    fig.update_traces(texttemplate="%{text:.0f}€", textposition="outside")
    fig.update_layout(
        showlegend=False,
        plot_bgcolor="white",
        paper_bgcolor="white",
        height=350
    )
    st.plotly_chart(fig, use_container_width=True)

st.markdown("---")

# TOP ET FLOP NATIONAL
col1, col2 = st.columns(2)

with col1:
    st.subheader("Top 20 villes les plus cheres")
    top20 = villes.nlargest(20, "prix_m2_moyen")
    fig = px.bar(
        top20,
        x="prix_m2_moyen",
        y="nom_commune",
        orientation="h",
        color="prix_m2_moyen",
        color_continuous_scale=["#ffb347", "#ff6b2b"],
        text="prix_m2_moyen",
        labels={"prix_m2_moyen": "Prix m2 (€)", "nom_commune": "Ville"}
    )
    fig.update_traces(texttemplate="%{text:.0f}€", textposition="outside")
    fig.update_layout(
        showlegend=False,
        plot_bgcolor="white",
        paper_bgcolor="white",
        coloraxis_showscale=False,
        height=500
    )
    st.plotly_chart(fig, use_container_width=True)

with col2:
    st.subheader("Top 20 villes les moins cheres")
    bottom20 = villes.nsmallest(20, "prix_m2_moyen")
    fig = px.bar(
        bottom20,
        x="prix_m2_moyen",
        y="nom_commune",
        orientation="h",
        color="prix_m2_moyen",
        color_continuous_scale=["#ff6b2b", "#ffb347"],
        text="prix_m2_moyen",
        labels={"prix_m2_moyen": "Prix m2 (€)", "nom_commune": "Ville"}
    )
    fig.update_traces(texttemplate="%{text:.0f}€", textposition="outside")
    fig.update_layout(
        showlegend=False,
        plot_bgcolor="white",
        paper_bgcolor="white",
        coloraxis_showscale=False,
        height=500
    )
    st.plotly_chart(fig, use_container_width=True)

st.markdown("---")

# DISTRIBUTION DES PRIX
st.subheader("Distribution des prix m2 par departement")
fig = px.box(
    dept,
    x="prix_m2_moyen",
    points="all",
    color_discrete_sequence=["#ff6b2b"],
    labels={"prix_m2_moyen": "Prix m2 moyen (€)"},
    title="Distribution nationale des prix m2"
)
fig.update_layout(
    plot_bgcolor="white",
    paper_bgcolor="white",
    height=300
)
st.plotly_chart(fig, use_container_width=True)

st.markdown("""
<div style="text-align:center; color:#aaaaaa; font-size:0.8rem; padding:1.5rem 0 0.5rem; border-top:1px solid #eeeeee; margin-top:1rem;">
    <strong style="color:#ff6b2b;">Homepedia</strong> - Donnees DVF 2023 - 1 066 032 transactions - Epitech
</div>
""", unsafe_allow_html=True)