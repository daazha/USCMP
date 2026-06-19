import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Input, Select, Spin, Empty, Tag, Collapse } from 'antd';
import { SearchOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { getMembers } from '../api/client';
import type { MemberSummary } from '../api/types';
import { useAppStore } from '../store';
import MemberAvatar from '../components/MemberAvatar';

const { Option } = Select;

function getChamberLabel(chamber?: string) {
  return chamber === 'senate' ? '参议院' : chamber === 'house' ? '众议院' : '';
}

function getPartyLabel(party?: string) {
  return party === 'Democratic' ? '民主党' : party === 'Republican' ? '共和党' : party === 'Independent' ? '独立' : party || '';
}

function highlightText(text: string, keyword: string) {
  if (!keyword.trim()) return text;
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ background: '#fbbf24', color: '#1f2937', borderRadius: 2, padding: '0 2px' }}>{text.slice(idx, idx + keyword.length)}</span>
      {text.slice(idx + keyword.length)}
    </>
  );
}

interface GroupedMembers {
  [committee: string]: MemberSummary[];
}

function groupByCommittee(members: MemberSummary[]): { withCommittee: GroupedMembers; withoutCommittee: MemberSummary[] } {
  const withCommittee: GroupedMembers = {};
  const withoutCommittee: MemberSummary[] = [];

  for (const m of members) {
    if (m.committee_tags.length > 0) {
      const key = m.committee_tags[0];
      if (!withCommittee[key]) withCommittee[key] = [];
      withCommittee[key].push(m);
    } else {
      withoutCommittee.push(m);
    }
  }

  const sorted: GroupedMembers = {};
  for (const key of Object.keys(withCommittee).sort()) {
    sorted[key] = withCommittee[key];
  }

  return { withCommittee: sorted, withoutCommittee };
}

function MemberCard({ m, search, partyColorMap }: { m: MemberSummary; search: string; partyColorMap: Record<string, string> }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/member/${m.id}`)}
      style={{
        background: '#1a1a2e',
        borderRadius: 10,
        padding: 16,
        cursor: 'pointer',
        borderLeft: `3px solid ${partyColorMap[m.party || ''] || '#6b7280'}`,
        transition: 'transform 0.15s, box-shadow 0.15s',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <MemberAvatar image_url={m.image_url} display_name={m.display_name} party={m.party} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {search ? highlightText(m.display_name, search) : m.display_name}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>
          <span style={{ color: partyColorMap[m.party || ''] || '#9ca3af' }}>{getPartyLabel(m.party)}</span>
          <span style={{ margin: '0 3px' }}>|</span>
          {getChamberLabel(m.chamber)}
          {m.state ? <><span style={{ margin: '0 3px' }}>|</span>{m.state}</> : null}
        </div>
      </div>
      {m.committee_tags.length > 0 && (
        <Tag color="blue" style={{ fontSize: 9, margin: 0, borderRadius: 3, lineHeight: '16px', flexShrink: 0 }}>
          {m.committee_tags[0].length > 12 ? m.committee_tags[0].slice(0, 12) + '...' : m.committee_tags[0]}
        </Tag>
      )}
    </div>
  );
}

function CommitteeSection({ title, members, search, partyColorMap, defaultOpen = false }: {
  title: string; members: MemberSummary[]; search: string; partyColorMap: Record<string, string>; defaultOpen?: boolean;
}) {
  return (
    <Collapse
      defaultActiveKey={defaultOpen ? ['1'] : []}
      style={{ background: 'transparent', border: 'none', marginBottom: 8 }}
      expandIconPosition="end"
      items={[{
        key: '1',
        label: (
          <span style={{ color: '#d1d5db', fontSize: 13, fontWeight: 500 }}>
            <TeamOutlined style={{ marginRight: 6, color: '#6b7280' }} />
            {title}
            <Tag style={{ marginLeft: 8, fontSize: 10 }}>{members.length}</Tag>
          </span>
        ),
        children: (
          <Row gutter={[10, 10]}>
            {members.map((m) => (
              <Col key={m.id} xs={24} sm={12} md={8} lg={6}>
                <MemberCard m={m} search={search} partyColorMap={partyColorMap} />
              </Col>
            ))}
          </Row>
        ),
        style: { background: '#111827', border: '1px solid #1f2937', borderRadius: 8 },
      }]}
    />
  );
}

export default function OverviewPage() {
  const { members, setMembers, setError, loading, setLoading, totalMembers } = useAppStore();
  const [filter, setFilter] = useState({
    chamber: undefined as string | undefined,
    party: undefined as string | undefined,
    congress: undefined as number | undefined,
    search: '',
  });

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const result = await getMembers({ limit: 200, ...filter });
      setMembers(result.members, result.total);
    } catch {
      setError('加载议员列表失败');
    } finally {
      setLoading(false);
    }
  };

  const partyColorMap: Record<string, string> = {
    Republican: '#f5222d',
    Democratic: '#1890ff',
    Independent: '#8c8c8c',
  };

  const filtered = useMemo(() => {
    if (!filter.search.trim()) return members;
    const q = filter.search.toLowerCase();
    return members.filter((m) => m.display_name.toLowerCase().includes(q));
  }, [members, filter.search]);

  const senateMembers = useMemo(() => filtered.filter((m) => m.chamber === 'senate'), [filtered]);
  const houseMembers = useMemo(() => filtered.filter((m) => m.chamber === 'house'), [filtered]);

  const senateGrouped = useMemo(() => groupByCommittee(senateMembers), [senateMembers]);
  const houseGrouped = useMemo(() => groupByCommittee(houseMembers), [houseMembers]);

  const renderChamber = (chamberLabel: string, grouped: ReturnType<typeof groupByCommittee>, count: number) => {
    const committeeKeys = Object.keys(grouped.withCommittee);
    const hasContent = committeeKeys.length > 0 || grouped.withoutCommittee.length > 0;
    if (!hasContent) return null;

    return (
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <h2 style={{ color: '#e5e7eb', fontSize: 16, fontWeight: 600, margin: 0 }}>
            {chamberLabel}
          </h2>
          <Tag style={{ fontSize: 11 }}>{count} 人</Tag>
        </div>

        {committeeKeys.map((cmte) => (
          <CommitteeSection
            key={cmte}
            title={cmte}
            members={grouped.withCommittee[cmte]}
            search={filter.search}
            partyColorMap={partyColorMap}
            defaultOpen={committeeKeys.length <= 3}
          />
        ))}

        {grouped.withoutCommittee.length > 0 && (
          <CommitteeSection
            title="无委员会任职"
            members={grouped.withoutCommittee}
            search={filter.search}
            partyColorMap={partyColorMap}
            defaultOpen={committeeKeys.length === 0}
          />
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '24px 40px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 600, margin: 0 }}>
            美国国会利益关联图谱
          </h1>
          <span style={{ color: '#6b7280', fontSize: 12 }}>
            共 {totalMembers} 位议员
          </span>
        </div>
        <Row gutter={12} align="middle">
          <Col span={8}>
            <Input
              prefix={<SearchOutlined style={{ color: '#6b7280' }} />}
              placeholder="搜索议员姓名..."
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              onPressEnter={loadMembers}
              style={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="议院"
              allowClear
              style={{ width: '100%' }}
              value={filter.chamber}
              onChange={(v) => setFilter({ ...filter, chamber: v })}
            >
              <Option value="senate">参议院</Option>
              <Option value="house">众议院</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="党派"
              allowClear
              style={{ width: '100%' }}
              value={filter.party}
              onChange={(v) => setFilter({ ...filter, party: v })}
            >
              <Option value="Democratic">民主党</Option>
              <Option value="Republican">共和党</Option>
              <Option value="Independent">独立</Option>
            </Select>
          </Col>
          <Col span={3}>
            <Select
              placeholder="届次"
              allowClear
              style={{ width: '100%' }}
              value={filter.congress}
              onChange={(v) => setFilter({ ...filter, congress: v })}
            >
              <Option value={117}>第 117 届</Option>
              <Option value={118}>第 118 届</Option>
              <Option value={119}>第 119 届</Option>
            </Select>
          </Col>
        </Row>
      </div>

      <Spin spinning={loading}>
        {filtered.length === 0 && !loading ? (
          <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <>
            {renderChamber('参议院', senateGrouped, senateMembers.length)}
            {renderChamber('众议院', houseGrouped, houseMembers.length)}
          </>
        )}
      </Spin>
    </div>
  );
}