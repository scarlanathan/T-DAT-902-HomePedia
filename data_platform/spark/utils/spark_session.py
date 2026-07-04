from pyspark.sql import SparkSession


def create_spark_session(app_name: str, event_log_dir: str = "/tmp/spark-events") -> SparkSession:
    return (
        SparkSession.builder
        .appName(app_name)
        .config("spark.eventLog.enabled", "true")
        .config("spark.eventLog.dir", event_log_dir)
        .config("spark.sql.shuffle.partitions", "8")
        .getOrCreate()
    )
