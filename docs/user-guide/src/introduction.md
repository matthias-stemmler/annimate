# ![Annimate logo](img/annimate-logo.png) Annimate<br>Your Friendly ANNIS Match Exporter

Annimate (for <u>ANNI</u>S <u>Mat</u>ch <u>E</u>xporter) is a tool for the convenient export of query results (matches) from the ANNIS[^1] system for linguistic corpora.

It is meant as a supplement to the ANNIS web interface and focuses on file export (as opposed to visualization) of the results of an ANNIS query.

> Annimate is being developed by [Matthias Stemmler](https://github.com/matthias-stemmler) in cooperation with the [Lehrstuhl für Deutsche Sprachwissenschaft](https://www.uni-augsburg.de/de/fakultaet/philhist/professuren/germanistik/deutsche-sprachwissenschaft/) at the University of Augsburg.
>
> It is based on the [graphANNIS](https://github.com/korpling/graphANNIS) library by Thomas Krause.

Annimate can currently produce a CSV or an Excel file with one row per match, showing the matched nodes in their context in a KWIC (Keyword in Context) format as well as additional annotations of the matched nodes and metadata on the corpus and document levels. It is similar in functionality to a combination of the ANNIS `TextColumnExporter` and `CSVExporter`, but provides a friendlier user interface.

This User Guide explains the details on how to work with Annimate.

## Table of Contents

1. [Installation](installation.md)
2. [Importing Corpus Data](import.md)
3. [Exporting Query Results](export.md)
4. [Links](links.md)

If you are unfamiliar with Annimate, we recommend that you go through all sections one by one, starting with [Installation](installation.md).

## Feedback

If you have any kind of feedback on Annimate such as a bug report, documentation issue or idea for a new feature, please [create an issue](https://github.com/matthias-stemmler/annimate/issues/new/choose) in the Annimate GitHub repository.


[^1]:
    **Krause, Thomas & Zeldes, Amir** (2016):
    _ANNIS3: A new architecture for generic corpus query and visualization._
    in: Digital Scholarship in the Humanities 2016 (31).
    <https://dsh.oxfordjournals.org/content/31/1/118>
