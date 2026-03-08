# ANNIS

See the [ANNIS User Guide](https://korpling.github.io/ANNIS/4/user-guide/) and [graphANNIS Data model](https://korpling.github.io/graphANNIS/docs/v2.2/data-model.html) for general background.

## Data Model

ANNIS represents linguistic corpora as annotation graphs. **Nodes** and **edges** can each carry annotations. Annotations have a **namespace** and a **name** (namespace may be empty). Edges are organized into **components**, each identified by a type, a namespace, and a name.

The component types relevant to Annimate are:

| Type       | Description                                                          |
| ---------- | -------------------------------------------------------------------- |
| `Coverage` | Edges from span or structural nodes to the tokens they cover         |
| `Ordering` | Sequential edges defining document order within a tokenization layer |

### Node Names

Every node has a unique `annis:node_name`. Names follow the pattern `corpus/doc#node`, where the corpus segment is URL-encoded when embedded in a name but not as the corpus root node name itself. Annimate derives the corpus name and document name from a node name by splitting on `/` and `#` respectively.

### Special Annotations

The `annis` namespace is reserved. Annimate uses the following annotations from it:

| Key               | Description                                                                             |
| ----------------- | --------------------------------------------------------------------------------------- |
| `annis:doc`       | Document name; presence on a node identifies it as a document                           |
| `annis:node_name` | Unique node identifier within the corpus                                                |
| `annis:node_type` | Node type: `"node"` for annotation graph nodes, `"corpus"` for corpus or document nodes |
| `annis:tok`       | Token text; present on every token node                                                 |

**Tokens** are nodes that have an `annis:tok` annotation and no outgoing `Coverage` edges.

### Special Components

| Component                       | Description                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Ordering/annis/""`             | Default token ordering (document order of the base tokenization)                                                   |
| `Ordering/annis/datasource-gap` | Artificially added by `CorpusStorage::subgraph` to mark gaps between non-adjacent tokens in the extracted subgraph |

### Segmentations

A _segmentation_ is an alternative tokenization layer. It is identified by an `Ordering` component whose namespace is **not** `annis` and whose name is **not** empty. Segmentation nodes carry a corresponding annotation; by convention this is `default_ns:<segmentation-name>`, but exceptions exist (e.g. ReM 2.x uses a different namespace).

## AQL

ANNIS Query Language (AQL) searches annotation graphs. Points relevant to Annimate:

- Annotation references can be fully qualified (`ns:name`) or name-only (`name`, matches any namespace). There is no syntax for matching annotations with an explicitly empty namespace.
- `tok` is a keyword that matches `annis:tok`; it cannot be written as `annis:tok`.

## Design Decisions

### Annotation Key Lists

- **Node annotations**: all annotation keys found in _any_ of the selected corpora.
- **Corpus and document meta-annotations**: annotation keys on nodes where `annis:node_type = "corpus"` (covers both corpus nodes and document nodes).

Unlike ANNIS itself, Annimate does not exclude meta-annotations from the node annotation list, for two reasons:

1. A meta node can also be a match node.
2. The same annotation key may appear on both meta nodes and ordinary nodes. Filtering out keys that _only_ appear on meta nodes would require an AQL query per key to check whether it also occurs on non-meta nodes. This is too slow in general, and outright impossible for keys with an empty namespace - because AQL name-only references match any namespace, there is no way to query specifically for an annotation with an empty namespace.

### Segmentation List

The segmentation list contains only segmentations present in **all** selected corpora, because context export requires a segmentation that exists in every corpus being exported.

For each segmentation, the corresponding annotation key is chosen as follows: collect all annotation keys present in all selected corpora, then pick `default_ns:<segmentation-name>` if it exists, otherwise the first key in alphabetical order.

### Segmentation Use in Context Export

Segmentations are used in three distinct places during "Match in context" export:

1. **Subgraph extraction** (`CorpusStorage::subgraph`): graphANNIS looks for `Ordering/default_ns/<name>` internally. If no such component exists in a corpus, Annimate passes no segmentation name, falling back to token-based context.
2. **Finding segmentation nodes**: nodes covered by the match within the context window.
3. **Exporting segmentation text**: the value of the segmentation annotation on each segmentation node. The user can also choose a different annotation to export instead. The dropdown shows all annotations present in _any_ selected corpus, consistent with other annotation dropdowns. Restricting it to annotations that actually occur on segmentation nodes is impractical for two reasons. First, the empty-namespace problem from [Annotation Key Lists](#annotation-key-lists) applies here too. Second, the annotation key that identifies the segmentation - and therefore which nodes count as its segmentation nodes - is determined by the full corpus selection via intersection, not per corpus. For example, if corpus A has both `default_ns:seg` and `foo:seg` and corpus B only has `foo:seg`, the segmentation is identified by `foo:seg` when both are selected but by `default_ns:seg` when only corpus A is selected. Although annotations are cached per corpus, the segmentation annotation key cannot be stored in that cache: it is a cross-corpus derived fact, determined by the intersection of annotation keys across all selected corpora, and is only known once the full corpus selection is complete.

### Corpus Name Lookup

Annimate derives the corpus name for a match from the list of imported corpora rather than by parsing the node name prefix. This supports importing a corpus under a different name than its intrinsic name (the one embedded in node names).

### Annotation Lookup via Coverage

When exporting a match node annotation, if the annotation is not directly on the match node, Annimate also searches the tokens covered by that node and any nodes covering those tokens. This handles corpora where the annotation lives on an overlapping span rather than on the match node itself. This fallback does not apply to "Match in context" export, where only the annotation directly on the match node is used.

### Query Validation

Annimate validates AQL queries against an empty dummy corpus for fast syntax checking without loading actual corpus data. Corpus-dependent semantic errors are only caught at export time.
