import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Card, Tag, Descriptions, Button, Spin, Tabs, message, Progress, Alert } from 'antd';
import { ArrowLeftOutlined, FileTextOutlined } from '@ant-design/icons';
import { getMember, getMemberGraph, expandGraph, getEvidence, generateReport, predictVote } from '../api/client';
import type { MemberDetail, GraphResponse, EvidenceResponse, PredictionResponse } from '../api/types';
import GraphCanvas from '../components/GraphCanvas/GraphCanvas';
import EvidenceDrawer from '../components/EvidenceDrawer/EvidenceDrawer';

const { Sider, Content } = Layout;

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [evidence, setEvidence] = useState<EvidenceResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [m, g] = await Promise.all([
        getMember(id),
        getMemberGraph(id, { depth: 2, limit: 200 }),
      ]);
      setMember(m);
      setGraph(g);
      // Load prediction
      try {
        const p = await predictVote({ member_id: id });
        setPrediction(p);
      } catch {
        setPrediction(null);
      }
    } catch (e) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDoubleClick = async (nodeId: string) => {
    try {
      const g = await expandGraph({ node_id: nodeId, depth: 1, limit: 50 });
      if (graph) {
        const existingIds = new Set(graph.nodes.map((n) => n.id));
        const newNodes = g.nodes.filter((n) => !existingIds.has(n.id));
        const existingEdgeIds = new Set(graph.edges.map((e) => e.id));
        const newEdges = g.edges.filter((e) => !existingEdgeIds.has(e.id));
        setGraph({
          ...graph,
          nodes: [...graph.nodes, ...newNodes],
          edges: [...graph.edges, ...newEdges],
        });
      }
    } catch (e) {
      message.warning('展开节点失败');
    }
  };

  const handleEdgeClick = async (claimId: string) => {
    try {
      const ev = await getEvidence(claimId);
      setEvidence(ev);
      setDrawerOpen(true);
    } catch (e) {
      message.warning('获取证据失败');
    }
  };

  const handleExportMarkdown = async () => {
    if (!id) return;
    try {
      const report = await generateReport({ member_id: id, format: 'markdown', include_graph: true, include_predictions: true });
      const blob = new Blob([report.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${member?.canonical_name || 'report'}.md`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('简报已导出');
    } catch (e) {
      message.error('导出失败');
    }
  };

  const getPartyColor = (party?: string) => {
    if (party === 'Democratic') return '#1890ff';
    if (party === 'Republican') return '#f5222d';
    return '#8c8c8c';
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  if (!member) return <div style={{ padding: 24, color: '#9ca3af' }}>议员未找到</div>;

  return (
    <Layout style={{ height: '100%', background: 'transparent' }}>
      <Sider width={420} style={{ background: '#111827', borderRight: '1px solid #1f2937', overflow: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回</Button>
          <Button type="primary" icon={<FileTextOutlined />} onClick={handleExportMarkdown} size="small">
            导出简报
          </Button>
        </div>

        <Card size="small" style={{ marginBottom: 12 }} bodyStyle={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: getPartyColor(member.party),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 20,
            }}>
              {member.canonical_name.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{member.display_name}</div>
              <div style={{ color: '#9ca3af', fontSize: 13 }}>
                <Tag color={getPartyColor(member.party)} style={{ marginRight: 4 }}>{member.party}</Tag>
                {member.state} | {member.chamber === 'senate' ? '参议院' : '众议院'} | 第{member.congress}届
              </div>
            </div>
          </div>
        </Card>

        <Tabs
          size="small"
          items={[
            {
              key: 'committees',
              label: '委员会',
              children: (
                <div>
                  {member.committee_memberships.map((cm, i) => (
                    <Tag key={i} color="purple" style={{ marginBottom: 4 }}>{cm.committee} - {cm.role}</Tag>
                  ))}
                </div>
              ),
            },
            {
              key: 'career',
              label: '履历',
              children: (
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  {member.career_summary.map((entry: Record<string, unknown>, i: number) => (
                    <div key={i} style={{ fontSize: 12, marginBottom: 4, color: '#9ca3af' }}>
                      {entry.position as string} @ {entry.organization as string}
                    </div>
                  ))}
                </div>
              ),
            },
            {
              key: 'contributors',
              label: 'TOP5 献金',
              children: (
                <div>
                  {member.top_contributors.slice(0, 5).map((tc: Record<string, unknown>, i: number) => (
                    <div key={i} style={{ fontSize: 12, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{tc.organization as string}</span>
                      <span style={{ color: '#52c41a' }}>${(tc.amount as number)?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              key: 'holdings',
              label: 'TOP5 持股',
              children: (
                <div>
                  {member.top_holdings.slice(0, 5).map((th: Record<string, unknown>, i: number) => (
                    <div key={i} style={{ fontSize: 12, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{th.company as string} ({th.ticker as string})</span>
                      <span style={{ color: '#52c41a' }}>
                        ${(th.amount_min as number)?.toLocaleString()} - ${(th.amount_max as number)?.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              key: 'china',
              label: '涉华立场',
              children: (
                <div style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.6 }}>
                  {member.china_stance_summary || '暂无相关记录。'}
                </div>
              ),
            },
            {
              key: 'controversies',
              label: '争议与调查',
              children: (
                <div style={{ maxHeight: 250, overflow: 'auto' }}>
                  {member.controversies.length === 0 ? (
                    <div style={{ color: '#6b7280', fontSize: 12 }}>暂无公开争议与调查记录。</div>
                  ) : (
                    member.controversies.map((c: Record<string, unknown>, i: number) => (
                      <Card key={i} size="small" style={{ marginBottom: 8, background: '#1a1a2e' }}>
                        <Tag color="orange" style={{ marginBottom: 4 }}>{(c.type as string)?.toUpperCase()}</Tag>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>{c.description as string}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>
                          来源: {c.source_name as string} | 状态: {c.status as string}
                          {c.needs_review ? ' | 需人工复核' : ''}
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              ),
            },
            {
              key: 'prediction',
              label: '投票预测',
              children: (
                <div>
                  {!prediction ? (
                    <Spin size="small" />
                  ) : (
                    <div>
                      {prediction.evidence_count < 3 || prediction.data_quality_score < 0.6 ? (
                        <Alert
                          type="warning"
                          message="预测不可用"
                          description={`证据不足（${prediction.evidence_count} 条）或数据质量评分过低（${(prediction.data_quality_score * 100).toFixed(0)}%），无法进行可靠预测。`}
                          showIcon
                          style={{ marginBottom: 12 }}
                        />
                      ) : null}

                      {(prediction.probability >= 0.45 && prediction.probability <= 0.55 && prediction.predicted_position !== 'unknown') ? (
                        <Alert
                          type="info"
                          message="低置信度预测"
                          description="预测概率在45%-55%范围内，接近中立。此预测仅供参考，不应作为强预测对待。"
                          showIcon
                          style={{ marginBottom: 12 }}
                        />
                      ) : null}

                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>预测立场</div>
                        <Tag color={
                          prediction.predicted_position === 'support' ? 'green' :
                          prediction.predicted_position === 'oppose' ? 'red' :
                          prediction.predicted_position === 'uncertain' ? 'gold' : 'default'
                        } style={{ fontSize: 14, padding: '2px 12px' }}>
                          {prediction.predicted_position === 'support' ? '支持' :
                           prediction.predicted_position === 'oppose' ? '反对' :
                           prediction.predicted_position === 'uncertain' ? '不确定' : '未知'}
                        </Tag>
                      </div>

                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                          概率 ({prediction.confidence_level === 'high' ? '高置信度' :
                            prediction.confidence_level === 'medium' ? '中置信度' :
                            prediction.confidence_level === 'low' ? '低置信度' : '数据不足'})
                        </div>
                        <Progress
                          percent={Math.round(prediction.probability * 100)}
                          status={prediction.confidence_level === 'high' ? 'success' :
                            prediction.confidence_level === 'low' || prediction.predicted_position === 'uncertain' ? 'exception' : 'active'}
                          format={() => `${(prediction.probability * 100).toFixed(0)}%`}
                        />
                      </div>

                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>数据质量评分</div>
                        <Progress
                          percent={Math.round(prediction.data_quality_score * 100)}
                          size="small"
                          status={prediction.data_quality_score >= 0.6 ? 'active' : 'exception'}
                        />
                      </div>

                      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
                        证据数: {prediction.evidence_count} | 基线偏离: {(prediction.margin_from_baseline * 100).toFixed(0)}%
                      </div>

                      <Card size="small" style={{ background: '#1a1a2e', marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>解读</div>
                        <div style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.5 }}>
                          {prediction.interpretation || '暂无解读。'}
                        </div>
                      </Card>

                      {prediction.top_factors.length > 0 && (
                        <Card size="small" title="主要因素" style={{ background: '#1a1a2e', marginBottom: 8 }}>
                          {prediction.top_factors.map((f: Record<string, unknown>, i: number) => (
                            <div key={i} style={{ fontSize: 11, marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}>
                              <span>{f.description as string}</span>
                              <span style={{ color: '#40a9ff' }}>权重: {f.weight as number}</span>
                            </div>
                          ))}
                        </Card>
                      )}

                      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 8 }}>
                        {prediction.disclaimer}
                      </div>
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Sider>
      <Content style={{ background: '#0a0e17' }}>
        {graph && (
          <GraphCanvas
            graph={graph}
            onDoubleClickNode={handleDoubleClick}
            onEdgeClick={handleEdgeClick}
            height="100%"
          />
        )}
      </Content>
      <EvidenceDrawer
        open={drawerOpen}
        evidence={evidence}
        onClose={() => setDrawerOpen(false)}
      />
    </Layout>
  );
}
