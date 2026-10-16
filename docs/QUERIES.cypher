// These queries describe the running prototype's actual schema.
// Replace $workspace and $revision with your own demo values in FalkorDB Browser.

// Current active memory and source evidence.
MATCH (w:AirlockWorkspace {id: $workspace})
MATCH (s:AirlockNode {workspace: $workspace, kind: 'source'})-[r:LINK]->(f:AirlockNode {workspace: $workspace, kind: 'fact'})
WHERE s.revision = w.revision AND f.revision = w.revision AND r.kind = 'SUPPORTS'
RETURN s.key, f.key, f.payload;

// Actual multi-hop dependency lookup used by the preview planner.
// $ids includes retired fact IDs AND scope:<changed relation>, e.g. scope:ships_to.
// $revision is the reviewed immutable workspace snapshot.
MATCH p=(d:AirlockNode {workspace: $workspace, revision: $revision, kind: 'decision'})-[:LINK*1..16]->(target:AirlockNode {workspace: $workspace, revision: $revision})
WHERE target.key IN $ids
  AND all(edge IN relationships(p) WHERE edge.kind = 'DEPENDS_ON')
  AND all(node IN nodes(p) WHERE node.workspace = $workspace AND node.revision = $revision)
RETURN d.key AS decisionId, [node IN nodes(p) | node.key] AS nodeIds, length(p) AS hops
ORDER BY hops;

// Query source-linked evidence supplied to the researcher.
MATCH (source:AirlockNode {workspace: $workspace, revision: $revision, kind: 'source'})-[r:LINK]->(fact:AirlockNode {workspace: $workspace, revision: $revision, kind: 'fact'})
WHERE r.kind = 'SUPPORTS'
RETURN fact.payload AS payload;
// The application then filters these typed payloads by active status and requested policy relation.

// Inspect an agent's evidence path.
MATCH (w:AirlockWorkspace {id: $workspace})
MATCH (a:AirlockNode {workspace: $workspace, kind: 'agent'})-[made:LINK]->(d:AirlockNode)-[depends:LINK]->(f:AirlockNode)
WHERE a.revision = w.revision AND d.revision = w.revision AND f.revision = w.revision
AND made.kind = 'MADE' AND depends.kind = 'DEPENDS_ON'
RETURN a.key, d.payload, f.payload;

// Inspect original evidence behind a restored policy version.
MATCH (w:AirlockWorkspace {id: $workspace})
MATCH (restored:AirlockNode {workspace: $workspace, kind: 'fact'})-[r:LINK]->(original:AirlockNode {workspace: $workspace, kind: 'fact'})
WHERE restored.revision = w.revision AND original.revision = w.revision AND r.kind = 'RESTORES'
RETURN restored.key, restored.payload, original.key, original.payload;
