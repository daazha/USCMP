# Graph Query Safety Rules

1. Neo4j multi-hop query max depth: 2
2. Expand lazy-load query max depth: 1
3. All Cypher queries MUST include LIMIT
4. NEVER use unbounded queries: MATCH (m)-[*]->(n)
5. NEVER concatenate Cypher in API routes
6. All Cypher MUST be in backend/app/services/graph_service.py
7. All user input MUST be parameterized
8. Graph queries MUST support start_date, end_date, min_confidence
