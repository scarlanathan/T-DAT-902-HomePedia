import argparse
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql.types import (
    StructType, StructField,
    StringType, DoubleType, IntegerType, DateType,
)

from spark_session import create_spark_session
from metrics import track_job

DVF_SCHEMA = StructType([
    StructField("id_mutation", StringType(), True),
    StructField("date_mutation", DateType(), True),
    StructField("numero_disposition", IntegerType(), True),
    StructField("nature_mutation", StringType(), True),
    StructField("valeur_fonciere", DoubleType(), True),
    StructField("adresse_numero", StringType(), True),
    StructField("adresse_suffixe", StringType(), True),
    StructField("adresse_nom_voie", StringType(), True),
    StructField("adresse_code_voie", StringType(), True),
    StructField("code_postal", StringType(), True),
    StructField("code_commune", StringType(), True),
    StructField("nom_commune", StringType(), True),
    StructField("code_departement", StringType(), True),
    StructField("ancien_code_commune", StringType(), True),
    StructField("ancien_nom_commune", StringType(), True),
    StructField("id_parcelle", StringType(), True),
    StructField("ancien_id_parcelle", StringType(), True),
    StructField("numero_volume", StringType(), True),
    StructField("lot1_numero", StringType(), True),
    StructField("lot1_surface_carrez", DoubleType(), True),
    StructField("lot2_numero", StringType(), True),
    StructField("lot2_surface_carrez", DoubleType(), True),
    StructField("lot3_numero", StringType(), True),
    StructField("lot3_surface_carrez", DoubleType(), True),
    StructField("lot4_numero", StringType(), True),
    StructField("lot4_surface_carrez", DoubleType(), True),
    StructField("lot5_numero", StringType(), True),
    StructField("lot5_surface_carrez", DoubleType(), True),
    StructField("nombre_lots", IntegerType(), True),
    StructField("code_type_local", StringType(), True),
    StructField("type_local", StringType(), True),
    StructField("surface_reelle_bati", DoubleType(), True),
    StructField("nombre_pieces_principales", IntegerType(), True),
    StructField("code_nature_culture", StringType(), True),
    StructField("nature_culture", StringType(), True),
    StructField("code_nature_culture_speciale", StringType(), True),
    StructField("nature_culture_speciale", StringType(), True),
    StructField("surface_terrain", DoubleType(), True),
    StructField("longitude", DoubleType(), True),
    StructField("latitude", DoubleType(), True),
])


def read_dvf(spark: SparkSession, input_path: str) -> DataFrame:
    return (
        spark.read
        .option("header", "true")
        .option("delimiter", ",")
        .option("dateFormat", "yyyy-MM-dd")
        .schema(DVF_SCHEMA)
        .csv(input_path)
    )


def enrich_with_cog(df: DataFrame, spark: SparkSession) -> DataFrame:
    from pyspark.sql import functions as F

    cog_df = (
        spark.read
        .option("header", "true")
        .option("delimiter", ",")
        .csv("data_platform/tests/fixtures/cog_commune_sample.csv")
        .select(
            F.col("COM").alias("code_commune_cog"),
            F.col("DEP").alias("dep_cog"),
            F.col("LIBELLE").alias("nom_commune_cog"),
        )
    )

    return df.join(
        F.broadcast(cog_df),
        df["code_commune"] == cog_df["code_commune_cog"],
        how="left",
    ).drop("code_commune_cog")


def clean_dvf(df: DataFrame) -> DataFrame:
    from pyspark.sql import functions as F

    return (
        df
        # lignes sans identifiant de mutation ou sans date sont inexploitables
        .filter(F.col("id_mutation").isNotNull())
        .filter(F.col("date_mutation").isNotNull())
        # une transaction sans valeur ou avec valeur nulle n'a pas de sens
        .filter(F.col("valeur_fonciere").isNotNull())
        .filter(F.col("valeur_fonciere") > 0)
        # code commune obligatoire pour la jointure géographique
        .filter(F.col("code_commune").isNotNull())
        # normalisation : code département depuis code commune si absent
        .withColumn(
            "code_departement",
            F.when(
                F.col("code_departement").isNull(),
                F.substring(F.col("code_commune"), 1, 2)
            ).otherwise(F.col("code_departement"))
        )
        # surface terrain à 0 quand absente (cohérent pour les agrégats)
        .withColumn(
            "surface_terrain",
            F.coalesce(F.col("surface_terrain"), F.lit(0.0))
        )
        # ajout d'une colonne année pour faciliter les partitions temporelles
        .withColumn("annee_mutation", F.year(F.col("date_mutation")))
    )


def main():
    parser = argparse.ArgumentParser(description="DVF Spark processing job")
    parser.add_argument("--input", required=True, help="Path to DVF CSV (local or HDFS)")
    parser.add_argument("--output", required=True, help="Output path for Parquet")
    args = parser.parse_args()

    spark = create_spark_session("dvf-processing")
    raw_df = read_dvf(spark, args.input)
    rows_in = raw_df.count()
    print(f"DVF raw row count: {rows_in}")

    with track_job("dvf-processing", rows_in=rows_in) as metrics:
        clean_df = clean_dvf(raw_df)
        metrics["rows_out"] = clean_df.count()
        print(f"DVF clean row count: {metrics['rows_out']}")

        (
            clean_df
            .write
            .mode("overwrite")
            .partitionBy("code_departement")
            .parquet(args.output)
        )

    print(f"DVF written to {args.output}")
    spark.stop()


if __name__ == "__main__":
    main()
