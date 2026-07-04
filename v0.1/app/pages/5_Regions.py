import streamlit as st
import pandas as pd
import folium
from streamlit_folium import st_folium
import plotly.express as px
import json
import numpy as np
import sys
sys.path.append("app")
from style import apply_style
apply_style()

st.set_page_config(page_title="Regions - Homepedia", layout="wide")
st.title("Analyse par region")

@st.cache_data
def load_data():
    regions = pd.read_csv("data/cleaned/stats_region.csv")
    dept = pd.read_csv("data/cleaned/stats_departement_complet.csv")
    with open("data/raw/regions.geojson", "r", encoding="utf-8") as f:
        geo_regions = json.load(f)
    return regions, dept, geo_regions

regions, dept, geo_regions = load_data()

# METRIQUES
col1, col2, col3, col4 = st.columns(4)
col1.metric("Regions analysees", len(regions))
col2.metric("Prix m2 moyen national", f"{regions['prix_m2_moyen'].mean():.0f} €")
col3.metric("Region la plus chere", regions.loc[regions['prix_m2_moyen'].idxmax(), 'nom_region'])
col4.metric("Region la moins chere", regions.loc[regions['prix_m2_moyen'].idxmin(), 'nom_region'])

st.markdown("---")

# CARTE REGIONS
st.subheader("Carte des prix par region")

metric = st.selectbox(
    "Indicateur",
    ["prix_m2_moyen", "prix_m2_median", "nb_transactions", "prix_moyen"]
)

regions_map = regions.copy()
regions_map["code_region"] = regions_map["code_region"].astype(str)
regions_map[metric + "_log"] = np.log1p(regions_map[metric])

m = folium.Map(location=[46.5, 2.5], zoom_start=6, tiles="CartoDB positron")

folium.Choropleth(
    geo_data=geo_regions,
    data=regions_map,
    columns=["code_region", metric + "_log"],
    key_on="feature.properties.code",
    fill_color="YlOrRd",
    fill_opacity=0.8,
    line_opacity=0.3,
    legend_name=f"{metric} (log)",
    nan_fill_color="white",
    bins=6
).add_to(m)

for feature in geo_regions["features"]:
    code = feature["properties"]["code"]
    nom = feature["properties"]["nom"]
    row = regions_map[regions_map["code_region"] == str(code)]
    if len(row) > 0:
        r = row.iloc[0]
        if metric in ["prix_m2_moyen", "prix_m2_median", "prix_moyen"]:
            val = f"{r[metric]:,.0f} €"
        else:
            val = f"{r[metric]:,}"
        feature["properties"]["tooltip"] = f"{nom} : {val}"
    else:
        feature["properties"]["tooltip"] = f"{nom} : pas de donnees"

folium.GeoJson(
    geo_regions,
    style_function=lambda x: {"fillOpacity": 0, "weight": 0},
    tooltip=folium.GeoJsonTooltip(
        fields=["tooltip"],
        aliases=[""],
        localize=True
    )
).add_to(m)

st_folium(m, width=1200, height=500)

st.markdown("---")

# GRAPHIQUES
col1, col2 = st.columns(2)

with col1:
    st.subheader("Prix m2 moyen par region")
    fig = px.bar(
        regions.sort_values("prix_m2_moyen", ascending=True),
        x="prix_m2_moyen",
        y="nom_region",
        orientation="h",
        color="prix_m2_moyen",
        color_continuous_scale="Reds",
        labels={
            "prix_m2_moyen": "Prix m2 moyen (€)",
            "nom_region": "Region"
        }
    )
    fig.update_layout(showlegend=False, height=500)
    st.plotly_chart(fig, use_container_width=True)

with col2:
    st.subheader("Volume de transactions par region")
    fig = px.pie(
        regions,
        values="nb_transactions",
        names="nom_region",
        color_discrete_sequence=px.colors.sequential.Reds
    )
    fig.update_layout(height=500)
    st.plotly_chart(fig, use_container_width=True)

st.markdown("---")

# DETAIL PAR REGION
st.subheader("Detail par region")

region_select = st.selectbox(
    "Choisir une region",
    regions.sort_values("nom_region")["nom_region"].tolist()
)

region_data = regions[regions["nom_region"] == region_select].iloc[0]

col1, col2, col3, col4 = st.columns(4)
col1.metric("Prix m2 moyen", f"{region_data['prix_m2_moyen']:.0f} €")
col2.metric("Prix m2 median", f"{region_data['prix_m2_median']:.0f} €")
col3.metric("Transactions", f"{region_data['nb_transactions']:,}")
col4.metric("Surface moyenne", f"{region_data['surface_moyenne']:.0f} m2")

st.markdown("---")

# DEPARTEMENTS DE LA REGION
st.subheader(f"Departements de la region {region_select}")

code_region = str(region_data["code_region"])

dept_codes = {
    "84": ["01","03","07","15","26","38","42","43","63","69","73","74"],
    "32": ["02","59","60","62","80"],
    "75": ["16","17","19","23","24","33","40","47","64","79","86","87"],
    "27": ["21","25","39","58","70","71","89","90"],
    "53": ["22","29","35","56"],
    "24": ["18","28","36","37","41","45"],
    "94": ["2A","2B"],
    "44": ["08","10","51","52","54","55","57","67","68","88"],
    "11": ["75","77","78","91","92","93","94","95"],
    "76": ["09","11","12","30","31","32","34","46","48","65","66","81","82"],
    "52": ["44","49","53","72","85"],
    "28": ["14","27","50","61","76"],
    "93": ["04","05","06","13","83","84"],
    "01": ["971"],
    "02": ["972"],
    "03": ["973"],
    "04": ["974"],
    "06": ["976"]
}.get(code_region, [])

if dept_codes:
    dept_filtered = dept[dept["code_departement"].astype(str).isin(dept_codes)]
    if len(dept_filtered) > 0:
        fig = px.bar(
            dept_filtered.sort_values("prix_m2_moyen", ascending=False),
            x="code_departement",
            y="prix_m2_moyen",
            color="prix_m2_moyen",
            color_continuous_scale="Reds",
            text="nom_departement",
            labels={
                "prix_m2_moyen": "Prix m2 moyen (€)",
                "code_departement": "Departement"
            }
        )
        fig.update_traces(textposition="outside")
        fig.update_layout(showlegend=False)
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("Pas de donnees pour cette region")

st.markdown("---")
st.subheader("Tableau comparatif des regions")
st.dataframe(
    regions.sort_values("prix_m2_moyen", ascending=False).reset_index(drop=True),
    use_container_width=True,
    column_config={
        "code_region": "Code",
        "nom_region": "Region",
        "prix_m2_moyen": st.column_config.NumberColumn("Prix m2 moyen", format="%.0f €"),
        "prix_m2_median": st.column_config.NumberColumn("Prix m2 median", format="%.0f €"),
        "nb_transactions": st.column_config.NumberColumn("Transactions", format="%d"),
        "prix_moyen": st.column_config.NumberColumn("Prix moyen", format="%.0f €"),
        "surface_moyenne": st.column_config.NumberColumn("Surface moy.", format="%.0f m2"),
    }
)