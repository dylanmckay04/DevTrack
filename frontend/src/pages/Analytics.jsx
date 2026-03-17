import { useState, useEffect } from 'react'
import { getApplications } from '../services/api'
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'

const STATUS_COLORS = { applied: '#58a6ff', interviewing: '#d29922', offer: '#39d353', rejected: '#f85149' }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', padding: '8px 12px', fontSize: '11px' }}>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function Analytics() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getApplications().then((res) => setApplications(res.data)).finally(() => setLoading(false))
  }, [])

  const statusCounts = ['applied', 'interviewing', 'offer', 'rejected'].map((s) => ({
    status: s,
    count: applications.filter((a) => a.status === s).length,
  }))

  // Applications per week over the last 8 weeks
  const weeklyData = (() => {
    const weeks = {}
    const now = new Date()
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i * 7)
      const key = `${d.getMonth() + 1}/${d.getDate()}`
      weeks[key] = 0
    }
    applications.forEach((a) => {
      const d = new Date(a.created_at)
      const now = new Date()
      const diffWeeks = Math.floor((now - d) / (7 * 24 * 60 * 60 * 1000))
      if (diffWeeks <= 7) {
        const weekStart = new Date(d)
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())
        const key = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`
        if (key in weeks) weeks[key]++
      }
    })
    return Object.entries(weeks).map(([week, count]) => ({ week, count }))
  })()

  const total = applications.length
  const offerRate = total > 0 ? ((applications.filter((a) => a.status === 'offer').length / total) * 100).toFixed(1) : 0
  const interviewRate = total > 0 ? (((applications.filter((a) => a.status === 'interviewing').length + applications.filter((a) => a.status === 'offer').length) / total) * 100).toFixed(1) : 0

  if (loading) return <p style={{ padding: '24px', color: 'var(--text-muted)' }}>loading...</p>

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.heading}>analytics</span>
      </div>

      {/* Stats row */}
      <div style={styles.statsRow}>
        {[
          { label: 'total applications', value: total },
          { label: 'interview rate', value: `${interviewRate}%` },
          { label: 'offer rate', value: `${offerRate}%` },
          { label: 'active', value: applications.filter((a) => a.status !== 'rejected').length },
        ].map((stat) => (
          <div key={stat.label} style={styles.statCard}>
            <span style={styles.statValue}>{stat.value}</span>
            <span style={styles.statLabel}>{stat.label}</span>
          </div>
        ))}
      </div>

      <div style={styles.charts}>
        {/* Status breakdown */}
        <div style={styles.chartCard}>
          <h2 style={styles.chartTitle}>// applications by status</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusCounts} barSize={28}>
              <XAxis dataKey="status" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-overlay)' }} />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}
                label={false}
              >
                {statusCounts.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly activity */}
        <div style={styles.chartCard}>
          <h2 style={styles.chartTitle}>// applications per week</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { padding: '24px', maxWidth: '1000px', margin: '0 auto' },
  header: { marginBottom: '24px' },
  heading: { fontWeight: 700, fontSize: '13px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' },
  statCard: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '4px' },
  statValue: { fontSize: '24px', fontWeight: 700, color: 'var(--accent)' },
  statLabel: { fontSize: '10px', color: 'var(--text-muted)' },
  charts: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  chartCard: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px' },
  chartTitle: { color: 'var(--accent)', fontSize: '11px', fontWeight: 600, marginBottom: '16px' },
}
