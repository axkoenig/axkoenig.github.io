---
title: Squirrel Data Loading Framework
date: 2022-06-15
short_description: Benchmarking and contributing to Squirrel, a high-performance data loading tool for machine learning pipelines that significantly improves throughput.
tags: [research, machine-learning, data-loading, performance, open-source]
cover_image: images/squirrel.png
highlight: false
collaborators:
  - name: "T. Wollmann"
    affiliation: "Merantix Momentum"
    url: "https://scholar.google.com/citations?user=H8tlV-oAAAAJ&hl=de&oi=ao"
---

At [Merantix Momentum](http://merantix-momentum.com), I'm benchmarking our data loading tool [Squirrel](https://hub.docker.com/repository/docker/axkoenig/reflex_stack). Preliminary results show that data loading pipelines can benefit greatly from Squirrel's improved throughput. Upon open-sourcing Squirrel, our VP of Engineering, Dr. Thomas Wollmann, showcased some of our initial results at the [PyData 2022](https://www.youtube.com/watch?v=pZPbi4EmqEo) conference in Berlin.

![Squirrel](images/squirrel.png)

I'm also an active code contributor to Squirrel. The framework addresses common bottlenecks in machine learning data loading pipelines, providing a more efficient way to handle large-scale datasets. Our benchmarking work demonstrates significant performance improvements compared to traditional data loading approaches.

The research focuses on optimizing data pipeline throughput, which is often a critical bottleneck in machine learning workflows. By improving data loading efficiency, we enable faster iteration cycles and more efficient use of computational resources.

This work was conducted in collaboration with [Dr. Wollmann](https://scholar.google.com/citations?user=H8tlV-oAAAAJ&hl=de&oi=ao).

## Resources
- [PyData Talk](https://www.youtube.com/watch?v=pZPbi4EmqEo)
- [Code Repository](https://github.com/merantix-momentum/squirrel-core)
- [Zenodo](https://zenodo.org/record/7158000#.Y1a1CexBzwM)
- [Siemens Talk](https://www.youtube.com/watch?v=Z7ziAp0mb-o)
- [Slides](../../downloads/research/squirrel_slides.pdf)
