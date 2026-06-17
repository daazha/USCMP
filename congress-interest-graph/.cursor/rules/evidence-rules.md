# Evidence Node Rules

1. Neo4j relationships use claim_id + Claim + SourceDocument pattern
2. All fact relationships MUST include claim_id
3. Pattern: (Person)-[:HOLDS_STOCK { claim_id }]->(Organization), (Claim)-[:EVIDENCED_BY]->(SourceDocument)
4. All unstructured extracted relationships MUST have Claim, SourceDocument, original_snippet, URL, collected_at, extraction_method, confidence_score
5. Missing evidence MUST NOT be displayed as fact; mark as needs_review
