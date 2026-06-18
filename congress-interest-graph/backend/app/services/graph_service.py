"""Graph service - all Cypher queries centralized here.

v0.6.2: Ego network with include_related_people control.
Default: depth 1 only (center Person -> Party/State/Chamber/Committee +
EducationInstitution/Employer/Position/ProfileSource if available).
"""

from datetime import date
from typing import Optional
from app.db.neo4j import run_cypher


EGO_EDGE_TYPES = frozenset({
    "MEMBER_OF_PARTY", "REPRESENTS_STATE", "SERVES_IN", "ASSIGNED_TO",
    "EDUCATED_AT", "EMPLOYED_BY", "HELD_POSITION", "HAS_PROFILE_SOURCE",
})

_EGO_EDGE_LIST = (
    "['MEMBER_OF_PARTY','REPRESENTS_STATE','SERVES_IN','ASSIGNED_TO',"
    "'EDUCATED_AT','EMPLOYED_BY','HELD_POSITION','HAS_PROFILE_SOURCE']"
)


def _edge_filter(rel_var: str = "r") -> str:
    return f"type({rel_var}) IN {_EGO_EDGE_LIST}"


def get_member_graph(
    member_id: str,
    depth: int = 2,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    min_confidence: float = 0.0,
    limit: int = 200,
    include_related_people: bool = False,
) -> dict:
    """Get ego network centered on a member.

    Default (include_related_people=False):
      Depth 1 only: center Person -> Party/State/Chamber/Committee
                    + EducationInstitution/Employer/Position/ProfileSource

    include_related_people=True:
      Depth 2: expands to other Persons through shared entities.
      No direct Person-Person edges are traversed.

    start_date/end_date filter relationships by their date range.
    """
    params = {
        "member_id": member_id,
        "min_confidence": min_confidence,
        "limit": min(limit, 500),
        "start_date": str(start_date) if start_date else None,
        "end_date": str(end_date) if end_date else None,
    }

    date_clause = (
        "AND ($start_date IS NULL OR coalesce(r.start_date, $start_date) >= $start_date) "
        "AND ($end_date IS NULL OR coalesce(r.end_date, $end_date) <= $end_date)"
    )

    if depth == 1 or not include_related_people:
        query = f"""
            MATCH (p:Person {{id: $member_id}})-[r]-(n)
            WHERE (r.confidence_score >= $min_confidence OR r.confidence_score IS NULL)
              AND ({_edge_filter('r')})
              {date_clause}
            RETURN p, r, n
            LIMIT $limit
        """
    else:
        query = f"""
            MATCH (p:Person {{id: $member_id}})-[r1]-(n1)
            WHERE (r1.confidence_score >= $min_confidence OR r1.confidence_score IS NULL)
              AND ({_edge_filter('r1')})
              {date_clause.replace('r.', 'r1.')}
            OPTIONAL MATCH (n1)-[r2]-(n2:Person)
            WHERE (r2.confidence_score >= $min_confidence OR r2.confidence_score IS NULL)
              AND n2 <> p
              AND ({_edge_filter('r2')})
              {date_clause.replace('r.', 'r2.')}
            RETURN p, r1, r2, n1, n2
            LIMIT $limit
        """

    records = run_cypher(query, params)
    return {"records": records, "truncated": len(records) >= limit}


def expand_node(
    node_id: str,
    depth: int = 1,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    min_confidence: float = 0.0,
    limit: int = 200,
) -> dict:
    """Expand a single node to show direct ego-network connections."""
    params = {
        "node_id": node_id,
        "min_confidence": min_confidence,
        "limit": min(limit, 500),
        "start_date": str(start_date) if start_date else None,
        "end_date": str(end_date) if end_date else None,
    }
    query = f"""
        MATCH (n {{id: $node_id}})-[r]-(m)
        WHERE (r.confidence_score >= $min_confidence OR r.confidence_score IS NULL)
          AND ({_edge_filter('r')})
          AND ($start_date IS NULL OR coalesce(r.start_date, $start_date) >= $start_date)
          AND ($end_date IS NULL OR coalesce(r.end_date, $end_date) <= $end_date)
        RETURN n, r, m
        LIMIT $limit
    """
    records = run_cypher(query, params)
    return {"records": records, "truncated": len(records) >= limit}


def get_evidence(claim_id: str) -> dict:
    """Get evidence chain for a claim."""
    params = {"claim_id": claim_id}
    query = """
        MATCH (c:Claim {claim_id: $claim_id})-[e:EVIDENCED_BY]->(s:SourceDocument)
        RETURN c, e, s
    """
    records = run_cypher(query, params)
    return {"records": records}


