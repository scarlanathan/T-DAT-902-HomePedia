"""SparkSession factory shared by every cleaning job.

A single builder keeps the jobs portable between two run modes:

* **Cluster** - submitted with ``spark-submit --master spark://spark-master:7077``
  inside the docker stack; reads/writes ``hdfs://namenode:9000/lake/...``.
* **Local dev** - ``SPARK_MASTER=local[*]`` with ``LAKE_ROOT=file:///some/dir``;
  no Hadoop cluster needed, handy for iterating on the transform logic.

Both are driven purely by environment variables, so the job code never hard-codes
a master URL or a filesystem.
"""

from __future__ import annotations

import os

from pyspark.sql import SparkSession


def build_session(app_name: str) -> SparkSession:
    """Return a configured SparkSession.

    Respected environment variables:
      SPARK_MASTER               e.g. ``local[*]`` or ``spark://spark-master:7077``.
                                 If unset, defers to whatever ``spark-submit --master``
                                 provided (falling back to ``local[*]``).
      SPARK_SHUFFLE_PARTITIONS   shuffle parallelism (default 8 - these datasets are
                                 commune-scale, the Spark default of 200 only adds overhead).
    """
    builder = SparkSession.builder.appName(app_name)

    master = os.environ.get("SPARK_MASTER")
    if master:
        builder = builder.master(master)

    builder = builder.config(
        "spark.sql.shuffle.partitions",
        os.environ.get("SPARK_SHUFFLE_PARTITIONS", "8"),
    )
    # Snappy keeps the curated Parquet compact without a CPU penalty at this scale.
    builder = builder.config("spark.sql.parquet.compression.codec", "snappy")

    spark = builder.getOrCreate()
    spark.sparkContext.setLogLevel(os.environ.get("SPARK_LOG_LEVEL", "WARN"))
    return spark
