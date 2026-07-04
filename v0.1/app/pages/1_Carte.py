import streamlit as st
import pandas as pd
import folium
from folium.plugins import HeatMap
from streamlit_folium import st_folium
import numpy as np
import json
import sys
sys.path.append("app")
from style import apply_style
from database import get_stats_departement, get_departements_geojson, get_transactions_by_dept

st.set_page_config(page_title="Carte - Homepedia", layout="wide")
apply_style()

st.markdown("""
<div style="
    background: linear-gradient(135deg, #ff6b2b 0%, #ffb347 100%);
    padding: 1.5rem 2rem;
    border-radius: 16px;
    margin-bottom: 1.5rem;
">
    <h1 style="color:white; margin:0; font-size:2rem;">Carte des prix immobiliers</h1>
    <p style="color:rgba(255,255,255,0.85); margin:0.3rem 0 0;">Visualisation par departement - Donnees PostgreSQL</p>
</div>
""", unsafe_allow_html=True)

@st.cache_data
def load_data():
    df = get_stats_departement()
    pop = pd.read_csv("data/cleaned/population_departement.csv")
    pop["code_departement"] = pop["code_departement"].astype(str)
    df["code_departement"] = df["code_departement"].astype(str)
    df = df.merge(pop, on="code_departement", how="left")
    geo = get_departements_geojson()
    return df, geo

df, geo = load_data()

# TABS
tab1, tab2, tab3 = st.tabs(["Carte Choropleth", "Heat Map", "Bubble Map"])

with tab1:
    st.sidebar.header("Filtres")
    metric = st.sidebar.selectbox(
        "Indicateur",
        ["prix_m2_moyen", "prix_m2_median", "nb_transactions", "prix_moyen", "population"]
    )
    echelle = st.sidebar.radio("Echelle", ["Normale", "Logarithmique"], index=1)

    df_map = df.copy()
    if echelle == "Logarithmique":
        df_map[metric + "_display"] = np.log1p(df_map[metric])
        display_col = metric + "_display"
    else:
        display_col = metric

    m = folium.Map(location=[46.5, 2.5], zoom_start=6, tiles="CartoDB positron")

    folium.Choropleth(
        geo_data=geo,
        data=df_map,
        columns=["code_departement", display_col],
        key_on="feature.properties.code",
        fill_color="YlOrRd",
        fill_opacity=0.8,
        line_opacity=0.3,
        legend_name=f"{metric} {'(log)' if echelle == 'Logarithmique' else ''}",
        nan_fill_color="white",
        bins=8
    ).add_to(m)

    for feature in geo["features"]:
        code = feature["properties"]["code"]
        nom = feature["properties"]["nom"]
        row = df_map[df_map["code_departement"] == str(code)]
        if len(row) > 0:
            r = row.iloc[0]
            pop_val = f"{r['population']:,}" if pd.notna(r.get('population')) else "N/A"
            tooltip = (
                f"{nom} ({code}) | "
                f"Prix m2 : {r['prix_m2_moyen']:,.0f} EUR | "
                f"Transactions : {r['nb_transactions']:,} | "
                f"Population : {pop_val}"
            )
            feature["properties"]["tooltip"] = tooltip
        else:
            feature["properties"]["tooltip"] = f"{nom} : pas de donnees"

    folium.GeoJson(
        geo,
        style_function=lambda x: {"fillOpacity": 0, "weight": 0},
        tooltip=folium.GeoJsonTooltip(fields=["tooltip"], aliases=[""], localize=True)
    ).add_to(m)

    st_folium(m, width=1200, height=600)

    st.markdown("---")
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Prix m2 moyen national", f"{df['prix_m2_moyen'].mean():.0f} €")
    col2.metric("Dept le plus cher", f"{df.loc[df['prix_m2_moyen'].idxmax(), 'code_departement']} - {df['prix_m2_moyen'].max():.0f} €")
    col3.metric("Dept le moins cher", f"{df.loc[df['prix_m2_moyen'].idxmin(), 'code_departement']} - {df['prix_m2_moyen'].min():.0f} €")
    col4.metric("Population totale", f"{df['population'].sum():,.0f}")

    st.markdown("---")
    st.subheader("Donnees par departement - Source PostgreSQL")
    st.dataframe(
        df.sort_values("prix_m2_moyen", ascending=False).reset_index(drop=True),
        use_container_width=True,
        column_config={
            "code_departement": "Dept",
            "nom_departement": "Nom",
            "prix_m2_moyen": st.column_config.NumberColumn("Prix m2 moyen", format="%.0f €"),
            "prix_m2_median": st.column_config.NumberColumn("Prix m2 median", format="%.0f €"),
            "nb_transactions": st.column_config.NumberColumn("Transactions", format="%d"),
            "prix_moyen": st.column_config.NumberColumn("Prix moyen", format="%.0f €"),
            "surface_moyenne": st.column_config.NumberColumn("Surface moy.", format="%.0f m2"),
            "population": st.column_config.NumberColumn("Population", format="%d"),
        }
    )

with tab2:
    st.subheader("Heat Map - Densite des transactions immobilieres")
    st.info("La heat map montre les zones de forte activite immobiliere en France")

    dept_select = st.selectbox(
        "Choisir un departement",
        ["Tous les departements"] + sorted(df["code_departement"].unique().tolist()),
        key="heat_dept"
    )

    with st.spinner("Chargement des donnees..."):
        if dept_select == "Tous les departements":
            heat_data = []
            for _, row in df.iterrows():
                transactions = get_transactions_by_dept(str(row["code_departement"]))
                transactions = transactions.dropna(subset=["latitude", "longitude"])
                for _, t in transactions.iterrows():
                    heat_data.append([t["latitude"], t["longitude"], t["prix_m2"]])
        else:
            transactions = get_transactions_by_dept(dept_select)
            transactions = transactions.dropna(subset=["latitude", "longitude"])
            heat_data = [
                [row["latitude"], row["longitude"], row["prix_m2"]]
                for _, row in transactions.iterrows()
            ]

    if heat_data:
        m_heat = folium.Map(location=[46.5, 2.5], zoom_start=6, tiles="CartoDB dark_matter")
        HeatMap(
            heat_data,
            radius=8,
            blur=10,
            min_opacity=0.3,
            gradient={0.2: "blue", 0.4: "cyan", 0.6: "yellow", 0.8: "orange", 1.0: "red"}
        ).add_to(m_heat)
        st_folium(m_heat, width=1200, height=600)
    else:
        st.warning("Pas de donnees GPS disponibles pour cette selection")

with tab3:
    st.subheader("Bubble Map - Prix m2 par departement")
    st.info("La taille des bulles represente le nombre de transactions, la couleur represente le prix m2")

    m_bubble = folium.Map(location=[46.5, 2.5], zoom_start=6, tiles="CartoDB positron")

    dept_coords = {
        "75": [48.8566, 2.3522], "69": [45.7640, 4.8357], "13": [43.2965, 5.3698],
        "33": [44.8378, -0.5792], "31": [43.6047, 1.4442], "67": [48.5734, 7.7521],
        "59": [50.6292, 3.0573], "06": [43.7102, 7.2620], "34": [43.6119, 3.8772],
        "44": [47.2184, -1.5536], "38": [45.1885, 5.7245], "76": [49.4432, 1.0993],
        "57": [49.1193, 6.1757], "35": [48.1173, -1.6778], "92": [48.8924, 2.2360],
        "93": [48.9356, 2.3539], "94": [48.7748, 2.4567], "78": [48.8014, 2.1301],
        "77": [48.6084, 2.7251], "91": [48.6321, 2.4436], "95": [49.0300, 2.0700],
        "01": [46.2044, 5.2258], "02": [49.5647, 3.6236], "03": [46.3633, 3.3326],
        "04": [44.0922, 6.2358], "05": [44.5553, 6.0700], "06": [43.7102, 7.2620],
        "07": [44.7289, 4.5995], "08": [49.7717, 4.7158], "09": [42.9679, 1.6072],
        "10": [48.2973, 4.0744], "11": [43.2130, 2.3491], "12": [44.3516, 2.5752],
        "14": [49.1829, -0.3707], "15": [45.0479, 2.6298], "16": [45.6495, 0.1565],
        "17": [45.7461, -0.6312], "18": [47.0810, 2.3988], "19": [45.2740, 1.7749],
        "21": [47.3220, 5.0415], "22": [48.5148, -2.7604], "23": [46.1667, 2.0000],
        "24": [45.1855, 0.7196], "25": [47.2380, 6.0243], "26": [44.9333, 4.8999],
        "27": [49.0893, 1.1501], "28": [48.4469, 1.4883], "29": [48.2020, -3.9996],
        "30": [43.8374, 4.3601], "31": [43.6047, 1.4442], "32": [43.6449, 0.5853],
        "33": [44.8378, -0.5792], "34": [43.6119, 3.8772], "35": [48.1173, -1.6778],
        "36": [46.8080, 1.6908], "37": [47.3941, 0.6848], "38": [45.1885, 5.7245],
        "39": [46.6734, 5.5549], "40": [43.8928, -0.4991], "41": [47.5860, 1.3359],
        "42": [45.4397, 4.3872], "43": [45.0433, 3.8840], "44": [47.2184, -1.5536],
        "45": [47.9029, 2.0012], "46": [44.6586, 1.4423], "47": [44.3506, 0.5363],
        "48": [44.5195, 3.4995], "49": [47.4784, -0.5632], "50": [49.1160, -1.3139],
        "51": [49.0440, 4.0237], "52": [48.1110, 5.1378], "53": [48.0698, -0.7699],
        "54": [48.6921, 6.1844], "55": [48.9984, 5.3833], "56": [47.7485, -2.9800],
        "57": [49.1193, 6.1757], "58": [47.0590, 3.6616], "59": [50.6292, 3.0573],
        "60": [49.4149, 2.8268], "61": [48.4285, 0.0932], "62": [50.4599, 2.8292],
        "63": [45.7772, 3.0870], "64": [43.2951, -0.3708], "65": [43.2333, 0.0781],
        "66": [42.6986, 2.8954], "67": [48.5734, 7.7521], "68": [47.7508, 7.3359],
        "69": [45.7640, 4.8357], "70": [47.6281, 6.1535], "71": [46.6765, 4.8271],
        "72": [48.0077, 0.1996], "73": [45.5646, 6.3927], "74": [45.8992, 6.1294],
        "76": [49.4432, 1.0993], "77": [48.6084, 2.7251], "78": [48.8014, 2.1301],
        "79": [46.3224, -0.4570], "80": [49.8941, 2.2958], "81": [43.9268, 2.1476],
        "82": [44.0176, 1.3554], "83": [43.4245, 6.0371], "84": [43.9493, 5.0860],
        "85": [46.6701, -1.4260], "86": [46.5802, 0.3404], "87": [45.8336, 1.2611],
        "88": [48.1739, 6.4509], "89": [47.7980, 3.5671], "90": [47.6382, 6.8628],
        "91": [48.6321, 2.4436], "92": [48.8924, 2.2360], "93": [48.9356, 2.3539],
        "94": [48.7748, 2.4567], "95": [49.0300, 2.0700],
    }

    max_prix = df["prix_m2_moyen"].max()
    min_prix = df["prix_m2_moyen"].min()

    for _, row in df.iterrows():
        code = str(row["code_departement"])
        if code in dept_coords:
            lat, lon = dept_coords[code]
            prix = row["prix_m2_moyen"]
            nb = row["nb_transactions"]
            radius = max(5, min(30, nb / 500))
            ratio = (prix - min_prix) / (max_prix - min_prix) if max_prix != min_prix else 0
            r = int(255 * ratio)
            g = int(100 * (1 - ratio))
            b = 0
            color = f"#{r:02x}{g:02x}{b:02x}"

            folium.CircleMarker(
                location=[lat, lon],
                radius=radius,
                color=color,
                fill=True,
                fill_color=color,
                fill_opacity=0.7,
                tooltip=f"{code} | Prix m2 : {prix:,.0f} € | Transactions : {nb:,}"
            ).add_to(m_bubble)

    st_folium(m_bubble, width=1200, height=600)