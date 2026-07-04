import streamlit as st
import pandas as pd
import plotly.express as px
import sys
sys.path.append("app")
from style import apply_style
apply_style()

st.set_page_config(page_title="Statistiques - Homepedia", layout="wide")
st.title("Statistiques immobilieres")

@st.cache_data
def load_data():
    dept = pd.read_csv("data/cleaned/spark_prix_departement.csv")
    villes = pd.read_csv("data/cleaned/spark_prix_ville.csv")
    types = pd.read_csv("data/cleaned/spark_type_bien.csv")
    return dept, villes, types

dept, villes, types = load_data()

# Metriques globales
col1, col2, col3, col4 = st.columns(4)
col1.metric("Prix m2 moyen national", f"{dept['prix_m2_moyen'].mean():.0f} €")
col2.metric("Prix m2 median national", f"{dept['prix_m2_median'].mean():.0f} €")
col3.metric("Transactions totales", f"{dept['nb_transactions'].sum():,}")
col4.metric("Departements", len(dept))

st.markdown("---")

# Top departements
col1, col2 = st.columns(2)

with col1:
    st.subheader("Top 10 departements les plus chers")
    top10 = dept.nlargest(10, "prix_m2_moyen")
    fig = px.bar(
        top10,
        x="code_departement",
        y="prix_m2_moyen",
        color="prix_m2_moyen",
        color_continuous_scale="Reds",
        labels={"prix_m2_moyen": "Prix m2 moyen (€)", "code_departement": "Departement"}
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
        color_continuous_scale="Blues",
        labels={"prix_m2_moyen": "Prix m2 moyen (€)", "code_departement": "Departement"}
    )
    st.plotly_chart(fig, use_container_width=True)

st.markdown("---")

# Maisons vs Appartements
st.subheader("Maisons vs Appartements par departement")
dept_select = st.selectbox("Choisir un departement", sorted(types["code_departement"].unique()))
filtered = types[types["code_departement"] == dept_select]
fig = px.bar(
    filtered,
    x="type_local",
    y="prix_m2_moyen",
    color="type_local",
    labels={"prix_m2_moyen": "Prix m2 moyen (€)", "type_local": "Type de bien"}
)
st.plotly_chart(fig, use_container_width=True)

st.markdown("---")

# Top villes
st.subheader("Top 20 villes les plus cheres")
top20_villes = villes.nlargest(20, "prix_m2_moyen")
fig = px.bar(
    top20_villes,
    x="nom_commune",
    y="prix_m2_moyen",
    color="prix_m2_moyen",
    color_continuous_scale="Reds",
    labels={"prix_m2_moyen": "Prix m2 moyen (€)", "nom_commune": "Ville"}
)
fig.update_xaxes(tickangle=45)
st.plotly_chart(fig, use_container_width=True)