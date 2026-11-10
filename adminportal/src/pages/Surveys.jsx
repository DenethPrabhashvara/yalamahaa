import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Download,
  Eye,
  FileSpreadsheet,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from '../components/ui/icons'
import { CATEGORY_TONE, SURVEY_TEMPLATES } from '../data/surveys'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api } from '../api/client'
import { cn, downloadCsv, formatDate, formatDateTime, formatNumber } from '../utils/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Progress } from '../components/ui/Progress'
import { Modal } from '../components/ui/Overlay'

function withoutSurveyTranslation(translations, field) {
  return Object.fromEntries(
    Object.entries(translations).flatMap(([language, content]) => {
      const next = { ...content }
      delete next[field]
      return Object.keys(next).length ? [[language, next]] : []
    }),
  )
}

function withoutTranslatedOptions(translations) {
  return Object.fromEntries(
    Object.entries(translations || {}).flatMap(([language, content]) => {
      const next = { ...content }
      delete next.options
      return Object.keys(next).length ? [[language, next]] : []
    }),
  )
}

export function Surveys() {
  const { toast } = useToast()
  const { canEdit } = useAuth()

  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSurveyId, setSelectedSurveyId] = useState(null)
  const [surveyDetails, setSurveyDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [resultsModalOpen, setResultsModalOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)

  // Audience data from API
  const [audiences, setAudiences] = useState({ all: 0, districts: [], reservoirs: [], tanks: [] })
  const [farmerSearch, setFarmerSearch] = useState('')
  const [availableFarmers, setAvailableFarmers] = useState([])
  const [loadingFarmers, setLoadingFarmers] = useState(false)
  const [farmerModalOpen, setFarmerModalOpen] = useState(false)

  // Form State for Builder
  const [activeTemplateId, setActiveTemplateId] = useState('flood_assessment')
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formTranslations, setFormTranslations] = useState({})
  const [formCategory, setFormCategory] = useState('flood')
  const [targetType, setTargetType] = useState('all')
  const [targetValue, setTargetValue] = useState('')
  const [pickedFarmers, setPickedFarmers] = useState([])
  const [questions, setQuestions] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // Results filter
  const [resultsFilter, setResultsFilter] = useState('')

  // Load audiences
  useEffect(() => {
    api('/admin/sms/audiences')
      .then((res) => {
        if (res.data) setAudiences(res.data)
      })
      .catch(() => {})
  }, [])

  // Load surveys list
  const loadSurveys = () => {
    setLoading(true)
    api('/admin/surveys')
      .then((res) => {
        setSurveys(res.data || [])
        setLoading(false)
      })
      .catch((err) => {
        toast(err.message || 'Failed to load surveys', { tone: 'error' })
        setLoading(false)
      })
  }

  // Load template into form
  const applyTemplate = (tpl) => {
    setActiveTemplateId(tpl.id)
    setFormTitle(tpl.title)
    setFormDesc(tpl.description)
    setFormTranslations(tpl.translations || {})
    setFormCategory(tpl.category)
    setQuestions(
      tpl.questions.map((q) => ({
        ...q,
        options: q.options ? [...q.options] : ['Option 1', 'Option 2'],
      }))
    )
  }

  useEffect(() => {
    loadSurveys()
    applyTemplate(SURVEY_TEMPLATES[0])
  }, [])

  // Load survey details and open modal
  const openResults = (id) => {
    setSelectedSurveyId(id)
    setLoadingDetails(true)
    setResultsModalOpen(true)
    api(`/admin/surveys/${id}`)
      .then((res) => {
        setSurveyDetails(res.data)
        setLoadingDetails(false)
      })
      .catch((err) => {
        toast(err.message || 'Failed to load results', { tone: 'error' })
        setLoadingDetails(false)
      })
  }

  // Search farmers for specific selection
  useEffect(() => {
    if (!farmerModalOpen) return
    let cancelled = false
    setLoadingFarmers(true)
    const t = setTimeout(() => {
      const q = encodeURIComponent(farmerSearch.trim())
      api(`/admin/farmers?limit=40&q=${q}&is_active=true`)
        .then((res) => {
          if (!cancelled) {
            setAvailableFarmers(res.data || [])
            setLoadingFarmers(false)
          }
        })
        .catch(() => {
          if (!cancelled) setLoadingFarmers(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [farmerSearch, farmerModalOpen])

  // Question manipulation
  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        question_text: '',
        question_type: 'choice',
        options: ['Option 1', 'Option 2'],
        required: true,
      },
    ])
  }

  const removeQuestion = (idx) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx))
  }

  const moveQuestion = (idx, dir) => {
    setQuestions((prev) => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      const temp = next[idx]
      next[idx] = next[target]
      next[target] = temp
      return next
    })
  }

  const updateQuestion = (idx, changes) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q
        const updated = { ...q, ...changes }
        if (Object.hasOwn(changes, 'question_text')) {
          updated.translations = undefined
        } else if (Object.hasOwn(changes, 'question_type')) {
          updated.translations = withoutTranslatedOptions(q.translations)
        }
        if (
          (updated.question_type === 'choice' || updated.question_type === 'multi_choice') &&
          (!updated.options || updated.options.length === 0)
        ) {
          updated.options = ['Option 1', 'Option 2']
        }
        return updated
      })
    )
  }

  const addOption = (qIdx) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q
        return {
          ...q,
          translations: withoutTranslatedOptions(q.translations),
          options: [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`],
        }
      })
    )
  }

  const updateOption = (qIdx, optIdx, val) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q
        const nextOpts = [...(q.options || [])]
        nextOpts[optIdx] = val
        return { ...q, translations: withoutTranslatedOptions(q.translations), options: nextOpts }
      })
    )
  }

  const removeOption = (qIdx, optIdx) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q
        return {
          ...q,
          translations: withoutTranslatedOptions(q.translations),
          options: (q.options || []).filter((_, oi) => oi !== optIdx),
        }
      })
    )
  }

  // Toggle status
  const handleToggleStatus = async (survey, e) => {
    e.stopPropagation()
    const nextStatus = survey.status === 'active' ? 'closed' : 'active'
    try {
      await api(`/admin/surveys/${survey.id}`, {
        method: 'PATCH',
        body: { status: nextStatus },
      })
      toast(`Survey #${survey.id} is now ${nextStatus}.`, { tone: 'success' })
      loadSurveys()
      if (surveyDetails?.id === survey.id) {
        setSurveyDetails((d) => ({ ...d, status: nextStatus }))
      }
    } catch (err) {
      toast(err.message || 'Status change failed', { tone: 'error' })
    }
  }

  // Delete survey
  const handleDeleteSurvey = async (surveyId, e) => {
    e?.stopPropagation?.()
    if (!window.confirm('Delete this survey and all collected farmer responses? This cannot be undone.')) return
    try {
      await api(`/admin/surveys/${surveyId}`, { method: 'DELETE' })
      toast('Survey deleted.', { tone: 'success' })
      if (resultsModalOpen && selectedSurveyId === surveyId) {
        setResultsModalOpen(false)
        setSelectedSurveyId(null)
        setSurveyDetails(null)
      }
      loadSurveys()
    } catch (err) {
      toast(err.message || 'Delete failed', { tone: 'error' })
    }
  }

  // Deploy survey
  const handleDeploySurvey = async (e) => {
    e.preventDefault()
    if (!formTitle.trim()) {
      toast('Please enter a survey title.', { tone: 'warning' })
      return
    }
    if (questions.length === 0) {
      toast('Add at least one question to the survey.', { tone: 'warning' })
      return
    }

    let targetPayload = { type: targetType, value: null, label: 'All Active Farmers' }
    if (targetType === 'district') {
      if (!targetValue) {
        toast('Please pick a district.', { tone: 'warning' })
        return
      }
      targetPayload = { type: 'district', value: targetValue, label: `District: ${targetValue}` }
    } else if (targetType === 'reservoir') {
      if (!targetValue) {
        toast('Please pick a reservoir.', { tone: 'warning' })
        return
      }
      const r = audiences.reservoirs.find((x) => String(x.id) === String(targetValue))
      targetPayload = { type: 'reservoir', value: Number(targetValue), label: `Reservoir: ${r?.name || targetValue}` }
    } else if (targetType === 'tank') {
      if (!targetValue) {
        toast('Please pick a tank.', { tone: 'warning' })
        return
      }
      const t = audiences.tanks.find((x) => String(x.id) === String(targetValue))
      targetPayload = { type: 'tank', value: Number(targetValue), label: `Tank: ${t?.name || targetValue}` }
    } else if (targetType === 'farmers') {
      if (pickedFarmers.length === 0) {
        toast('Select at least one farmer.', { tone: 'warning' })
        return
      }
      targetPayload = {
        type: 'farmers',
        value: pickedFarmers.map((f) => f.farmer_id),
        label: `${pickedFarmers.length} Selected Farmer${pickedFarmers.length === 1 ? '' : 's'}`,
      }
    }

    const payload = {
      title: formTitle.trim(),
      description: formDesc.trim(),
      translations: formTranslations,
      category: formCategory,
      target: targetPayload,
      questions,
    }

    setSubmitting(true)
    try {
      await api('/admin/surveys', {
        method: 'POST',
        body: payload,
      })
      toast('Survey deployed successfully!', { tone: 'success' })
      setSubmitting(false)
      loadSurveys()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      toast(err.message || 'Failed to deploy survey', { tone: 'error' })
      setSubmitting(false)
    }
  }

  // Export responses to CSV
  const handleExportCsv = () => {
    if (!surveyDetails?.responses?.length) {
      toast('No responses to export yet.', { tone: 'warning' })
      return
    }
    const filename = `survey-${surveyDetails.id}-${surveyDetails.category}-responses.csv`
    const rows = surveyDetails.responses.map((r) => {
      const row = {
        'Response ID': r.id,
        'Farmer Name': r.full_name,
        'Phone Number': r.phone,
        'Farm ID': r.farm_id || '',
        'District': r.district || '',
        'Division': r.division || '',
        'Submitted At': formatDateTime(r.submitted_at),
      }
      for (const q of surveyDetails.questions) {
        const val = r.answers?.[String(q.id)]
        row[`Q${q.position + 1}: ${q.question_text}`] = Array.isArray(val) ? val.join('; ') : val ?? ''
      }
      return row
    })
    downloadCsv(filename, rows)
  }

  // Scroll to composer at the bottom with proper topbar clearance
  const scrollToComposer = () => {
    setComposerOpen(true)
    window.setTimeout(() => {
      const el = document.getElementById('survey-composer')
      if (!el) return
      const topbarOffset = 70
      const elementTop = el.getBoundingClientRect().top + window.scrollY
      window.scrollTo({ top: Math.max(0, elementTop - topbarOffset), behavior: 'smooth' })
      const input = el.querySelector('input[type="text"]')
      window.setTimeout(() => input?.focus(), 400)
    }, 0)
  }

  // Target count estimate
  const estimatedCount = useMemo(() => {
    if (targetType === 'all') return audiences.all
    if (targetType === 'district') {
      return audiences.districts.find((d) => d.name.toLowerCase() === (targetValue || '').toLowerCase())?.farmers || 0
    }
    if (targetType === 'reservoir') {
      return audiences.reservoirs.find((r) => String(r.id) === String(targetValue))?.farmers || 0
    }
    if (targetType === 'tank') {
      return audiences.tanks.find((t) => String(t.id) === String(targetValue))?.farmers || 0
    }
    if (targetType === 'farmers') return pickedFarmers.length
    return 0
  }, [targetType, targetValue, pickedFarmers, audiences])

  // Filtered responses in modal
  const filteredResponses = useMemo(() => {
    if (!surveyDetails?.responses) return []
    if (!resultsFilter.trim()) return surveyDetails.responses
    const q = resultsFilter.toLowerCase()
    return surveyDetails.responses.filter(
      (r) =>
        r.full_name?.toLowerCase().includes(q) ||
        r.phone?.includes(q) ||
        r.farm_id?.toLowerCase().includes(q) ||
        r.district?.toLowerCase().includes(q)
    )
  }, [surveyDetails, resultsFilter])

  return (
    <div className="page surveys-page">
      <PageHeader
        eyebrow="Disaster Response & Damage Assessments"
        title="Disaster & Emergency Surveys"
        description="Deploy rapid damage assessment surveys to targeted farmer groups or individual farms during climate and agrarian events."
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button variant="secondary" onClick={loadSurveys}>
              Refresh
            </Button>
            {canEdit && (
              <Button variant="primary" onClick={scrollToComposer}>
                Create survey
              </Button>
            )}
          </div>
        }
      />

      {/* STATS ROW */}
      <div className="mini-stat-grid">
        <Card className="mini-stat">
          <span className="mini-stat-icon tone-primary">
            <ClipboardCheck size={17} />
          </span>
          <div>
            <span>Total Surveys</span>
            <strong>{formatNumber(surveys.length)}</strong>
            <small>Disaster assessments created</small>
          </div>
        </Card>

        <Card className="mini-stat">
          <span className="mini-stat-icon tone-warning">
            <AlertTriangle size={17} />
          </span>
          <div>
            <span>Active Polls</span>
            <strong>{surveys.filter((s) => s.status === 'active').length}</strong>
            <small>Currently live on farmer apps</small>
          </div>
        </Card>

        <Card className="mini-stat">
          <span className="mini-stat-icon tone-success">
            <CheckCircle2 size={17} />
          </span>
          <div>
            <span>Responses Received</span>
            <strong>{formatNumber(surveys.reduce((acc, s) => acc + (s.response_count || 0), 0))}</strong>
            <small>Completed farmer reports</small>
          </div>
        </Card>

        <Card className="mini-stat">
          <span className="mini-stat-icon tone-info">
            <Users size={17} />
          </span>
          <div>
            <span>Farmer Reach</span>
            <strong>{formatNumber(surveys.reduce((acc, s) => acc + (s.recipient_count || 0), 0))}</strong>
            <small>Eligible active farmers</small>
          </div>
        </Card>
      </div>

      {/* SECTION 1: ALL ACTIVE AND RECENT SURVEYS */}
      <Card className="table-card">
        <CardHeader
          icon={ClipboardCheck}
          title="Active & Past Assessment Surveys"
          description="Click on any survey to view live analytics, response breakdowns and export data"
          action={
            canEdit && (
              <Button variant="secondary" size="sm" onClick={scrollToComposer}>
                New survey
              </Button>
            )
          }
        />
        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--muted)' }}>
            Loading surveys…
          </div>
        ) : surveys.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              <ClipboardCheck size={24} />
            </span>
            <strong>No surveys created yet</strong>
            <span>Scroll down or click below to build your first disaster assessment survey.</span>
            {canEdit && (
              <Button variant="primary" size="sm" onClick={scrollToComposer} style={{ marginTop: 8 }}>
                Create survey
              </Button>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Survey Title</th>
                  <th>Category</th>
                  <th>Audience Scope</th>
                  <th style={{ minWidth: 160 }}>Response Rate</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {surveys.map((s) => {
                  const recipientCount = s.recipient_count || 0
                  const responseCount = s.response_count || 0
                  const pct = recipientCount > 0 ? Math.round((responseCount / recipientCount) * 100) : 0
                  const cat = (s.category || 'disaster').toLowerCase()
                  return (
                    <tr key={s.id} className="cursor-pointer" onClick={() => openResults(s.id)}>
                      <td>
                        <strong>{s.title}</strong>
                        {s.description && (
                          <div style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 2, maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <Badge tone={CATEGORY_TONE[cat] || 'neutral'}>
                          {cat.toUpperCase()}
                        </Badge>
                      </td>
                      <td>
                        <div>{s.target_label || 'All Farmers'}</div>
                        <small style={{ color: 'var(--muted)' }}>{formatNumber(recipientCount)} farmers</small>
                      </td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                          <span><strong>{responseCount}</strong> of {recipientCount}</span>
                          <span style={{ color: 'var(--muted)' }}>{pct}%</span>
                        </div>
                        <Progress value={pct} tone={pct > 50 ? 'success' : pct > 20 ? 'info' : 'neutral'} />
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>{formatDate(s.created_at)}</td>
                      <td>
                        <button
                          type="button"
                          className={cn('status-pill-btn', s.status === 'active' ? 'is-active' : 'is-closed')}
                          onClick={(e) => canEdit && handleToggleStatus(s, e)}
                          title={canEdit ? 'Click to toggle status' : undefined}
                        >
                          <span className="dot" />
                          {s.status === 'active' ? 'Active' : 'Closed'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Eye}
                            onClick={(e) => {
                              e.stopPropagation()
                              openResults(s.id)
                            }}
                          >
                            Results
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              className="survey-remove-btn"
                              onClick={(e) => handleDeleteSurvey(s.id, e)}
                              title="Delete survey"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create the builder only when an officer is ready to use it. */}
      <Card className="span-12 composer-card survey-composer-card" id="survey-composer">
        <CardHeader
          icon={Megaphone}
          title={composerOpen ? 'Create a survey' : 'Create a new survey'}
          description={composerOpen ? 'Choose a template, set the audience, and review the questions before sending.' : 'Start with a ready-made assessment or create a custom survey.'}
          action={
            canEdit && (
              <Button
                variant={composerOpen ? 'ghost' : 'primary'}
                icon={composerOpen ? X : Plus}
                onClick={() => setComposerOpen((open) => !open)}
              >
                {composerOpen ? 'Close' : 'Create survey'}
              </Button>
            )
          }
        />

        {composerOpen && <form onSubmit={handleDeploySurvey}>
          <div className="composer-body">
            <div className="survey-section-block">
              <div className="composer-label">
                <span>Start with a template</span>
              </div>
              <label className="field survey-template-field">
                <span>Template</span>
                <select
                  value={activeTemplateId}
                  onChange={(e) => {
                    const template = SURVEY_TEMPLATES.find((item) => item.id === e.target.value)
                    if (template) applyTemplate(template)
                  }}
                >
                  {SURVEY_TEMPLATES.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="survey-section-block">
              <div className="composer-label">
                <span>Survey details</span>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Survey Title *</span>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => {
                      setFormTitle(e.target.value)
                      setFormTranslations((current) => withoutSurveyTranslation(current, 'title'))
                    }}
                    placeholder="e.g. Mahaweli Flash Flood Emergency Survey"
                    required
                  />
                </label>

                <label className="field">
                  <span>Disaster Category</span>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  >
                    <option value="flood">Flood Assessment</option>
                    <option value="drought">Drought & Water Shortage</option>
                    <option value="pest">Pest / Disease Outbreak</option>
                    <option value="disaster">General Disaster</option>
                    <option value="general">Routine Agrarian Poll</option>
                  </select>
                </label>

                <label className="field span-2">
                  <span>Instructions for farmers</span>
                  <textarea
                    rows={2}
                    value={formDesc}
                    onChange={(e) => {
                      setFormDesc(e.target.value)
                      setFormTranslations((current) => withoutSurveyTranslation(current, 'description'))
                    }}
                    placeholder="Provide details on relief assessment and why this report is requested..."
                  />
                </label>
              </div>
            </div>

            <div className="survey-section-block">
              <div className="composer-label">
                <span>Who should receive it?</span>
                <span>{formatNumber(estimatedCount)} farmers</span>
              </div>

              <label className="field survey-template-field">
                <span>Audience</span>
                <select
                  value={targetType}
                  onChange={(e) => {
                    const type = e.target.value
                    setTargetType(type)
                    if (type === 'district') setTargetValue(audiences.districts[0]?.name || '')
                    else if (type === 'reservoir') setTargetValue(audiences.reservoirs[0]?.id || '')
                    else if (type === 'tank') setTargetValue(audiences.tanks[0]?.id || '')
                    else setTargetValue('')
                    if (type === 'farmers') setFarmerModalOpen(true)
                  }}
                >
                  <option value="all">All active farmers</option>
                  <option value="district">A district</option>
                  <option value="reservoir">A reservoir</option>
                  <option value="tank">A tank</option>
                  <option value="farmers">Selected farmers</option>
                </select>
              </label>

              {targetType === 'district' && (
                <label className="select-field">
                  <span>Select District</span>
                  <select
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                  >
                    {audiences.districts.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name} ({d.farmers} farmers)
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {targetType === 'reservoir' && (
                <label className="select-field">
                  <span>Select Major Reservoir</span>
                  <select
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                  >
                    {audiences.reservoirs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.farmers} farmers)
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {targetType === 'tank' && (
                <label className="select-field">
                  <span>Select Mahaweli Tank</span>
                  <select
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                  >
                    {audiences.tanks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.farmers} farmers)
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {targetType === 'farmers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{pickedFarmers.length} Farmers Selected</span>
                    <Button variant="outline" size="sm" onClick={() => setFarmerModalOpen(true)}>
                      Pick Farmers
                    </Button>
                  </div>
                  {pickedFarmers.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {pickedFarmers.slice(0, 8).map((f) => (
                        <Badge key={f.farmer_id} tone="neutral">
                          {f.full_name} ({f.district || f.farm_id})
                          <X
                            size={12}
                            style={{ cursor: 'pointer', marginLeft: 4 }}
                            onClick={() => setPickedFarmers((pf) => pf.filter((x) => x.farmer_id !== f.farmer_id))}
                          />
                        </Badge>
                      ))}
                      {pickedFarmers.length > 8 && (
                        <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center' }}>
                          +{pickedFarmers.length - 8} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="audience-reach-box">
                <Users size={15} color="var(--primary)" />
                <span>
                  Estimated reach: <strong>{formatNumber(estimatedCount)}</strong> active farmers in this audience.
                </span>
              </div>
            </div>

            <div className="survey-section-block">
              <div className="composer-label">
                <span>Questions ({questions.length})</span>
              </div>

              {questions.map((q, qIdx) => (
                <div key={qIdx} className="survey-question-item">
                  <div className="question-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="question-badge">Q{qIdx + 1}</span>
                      <select
                        className="survey-type-select"
                        value={q.question_type}
                        onChange={(e) => updateQuestion(qIdx, { question_type: e.target.value })}
                      >
                        <option value="choice">Single Choice (Radio)</option>
                        <option value="multi_choice">Multiple Choice (Checkboxes)</option>
                        <option value="yes_no">Yes / No Toggle</option>
                        <option value="number">Numeric (Acres / Depth)</option>
                        <option value="text">Open Comments</option>
                      </select>
                      <label className="survey-required-toggle">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => updateQuestion(qIdx, { required: e.target.checked })}
                        />
                        Required
                      </label>
                    </div>

                    <div className="question-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={ChevronUp}
                        disabled={qIdx === 0}
                        onClick={() => moveQuestion(qIdx, -1)}
                        title="Move question up"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={ChevronDown}
                        disabled={qIdx === questions.length - 1}
                        onClick={() => moveQuestion(qIdx, 1)}
                        title="Move question down"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => removeQuestion(qIdx)}
                        title="Delete question"
                      />
                    </div>
                  </div>

                  <label className="field">
                    <span>Question Prompt</span>
                    <input
                      type="text"
                      value={q.question_text}
                      onChange={(e) => updateQuestion(qIdx, { question_text: e.target.value })}
                      placeholder="Type question prompt..."
                      required
                    />
                  </label>

                  {/* Options editor for choice / multi_choice */}
                  {(q.question_type === 'choice' || q.question_type === 'multi_choice') && (
                    <div className="options-container">
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
                        Response Options:
                      </span>
                      {q.options?.map((opt, optIdx) => (
                        <div key={optIdx} className="option-input-row">
                          <span style={{ fontSize: 11, color: 'var(--muted)', width: 14 }}>{optIdx + 1}.</span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateOption(qIdx, optIdx, e.target.value)}
                            placeholder={`Option ${optIdx + 1}`}
                            required
                          />
                          {q.options.length > 2 && (
                            <button
                              type="button"
                              className="option-delete-btn"
                              onClick={() => removeOption(qIdx, optIdx)}
                              title="Remove option"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      {(!q.options || q.options.length < 8) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={Plus}
                          onClick={() => addOption(qIdx)}
                          style={{ alignSelf: 'flex-start' }}
                        >
                          Add Option
                        </Button>
                      )}
                    </div>
                  )}

                  {q.question_type === 'yes_no' && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                      Displays two large Yes / No touch buttons on the farmer&apos;s phone.
                    </div>
                  )}

                  {q.question_type === 'number' && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                      Opens numeric keyboard for acres or depth measurements.
                    </div>
                  )}

                  {q.question_type === 'text' && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                      Displays a clean text area for custom farmer comments.
                    </div>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                icon={Plus}
                onClick={addQuestion}
                style={{ marginTop: 8 }}
              >
                Add another question
              </Button>
            </div>
          </div>

          {canEdit && (
            <div className="composer-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? 'Deploying to farmers…' : 'Deploy Survey'}
              </Button>
            </div>
          )}
        </form>}
      </Card>

      {/* RESULTS MODAL */}
      {resultsModalOpen && surveyDetails && (
        <Modal
          title={surveyDetails.title}
          description={`Audience: ${surveyDetails.target_label || 'All Active Farmers'} - ${formatNumber(surveyDetails.response_count || 0)} of ${formatNumber(surveyDetails.recipient_count || 0)} responded`}
          open={resultsModalOpen}
          size="lg"
          onClose={() => setResultsModalOpen(false)}
        >
          <div style={{ maxHeight: '78vh', overflowY: 'auto', paddingRight: 4, minWidth: 620 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge tone={CATEGORY_TONE[surveyDetails.category] || 'neutral'}>
                  {(surveyDetails.category || 'disaster').toUpperCase()}
                </Badge>
                <Badge tone={surveyDetails.status === 'active' ? 'success' : 'neutral'} dot>
                  {surveyDetails.status === 'active' ? 'Live' : 'Closed'}
                </Badge>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Download}
                  onClick={handleExportCsv}
                  disabled={!surveyDetails.responses?.length}
                >
                  Export CSV
                </Button>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Trash2}
                    className="survey-remove-btn"
                    onClick={(e) => handleDeleteSurvey(surveyDetails.id, e)}
                  >
                    Remove Survey
                  </Button>
                )}
              </div>
            </div>

            {/* SUMMARY ANALYTICS GRIDS */}
            <div className="analytics-grid">
              {(surveyDetails.questions || []).map((q) => {
                const summary = surveyDetails.summary?.[String(q.id)]
                return (
                  <div key={q.id} className="analytics-card">
                    <div className="analytics-title">
                      <span className="question-badge">Q{q.position + 1}</span>
                      <span>{q.question_text}</span>
                    </div>

                    {(q.question_type === 'choice' || q.question_type === 'multi_choice' || q.question_type === 'yes_no') && (
                      <div>
                        {Object.entries(summary?.tallies || {}).map(([opt, count]) => {
                          const total = surveyDetails.response_count || 1
                          const pct = Math.round((count / total) * 100)
                          return (
                            <div key={opt} className="tally-row">
                              <div className="tally-meta">
                                <span>{opt}</span>
                                <strong>{count} ({pct}%)</strong>
                              </div>
                              <Progress value={pct} tone="info" />
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {q.question_type === 'number' && (
                      <div className="num-stat-grid">
                        <div className="num-stat-box">
                          <span>Avg</span>
                          <strong>{summary?.avg ?? 0}</strong>
                        </div>
                        <div className="num-stat-box">
                          <span>Min</span>
                          <strong>{summary?.min ?? 0}</strong>
                        </div>
                        <div className="num-stat-box">
                          <span>Max</span>
                          <strong>{summary?.max ?? 0}</strong>
                        </div>
                      </div>
                    )}

                    {q.question_type === 'text' && (
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                        {summary?.count || 0} written comment(s) received.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* TABULAR RESPONSES */}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 650, fontSize: 13 }}>Farmer Responses ({filteredResponses.length})</span>
                <label className="search-field" style={{ width: 220 }}>
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Search farmer or phone…"
                    value={resultsFilter}
                    onChange={(e) => setResultsFilter(e.target.value)}
                  />
                </label>
              </div>

              {filteredResponses.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  No responses recorded yet.
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Farmer</th>
                        <th>District</th>
                        <th>Submitted</th>
                        {(surveyDetails.questions || []).map((q) => (
                          <th key={q.id} style={{ minWidth: 150 }}>
                            Q{q.position + 1}: {q.question_text}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResponses.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.full_name}</strong>
                            <div style={{ color: 'var(--muted)', fontSize: 11 }}>{r.phone} {r.farm_id && `- ${r.farm_id}`}</div>
                          </td>
                          <td style={{ fontSize: 12 }}>{r.district || '—'}</td>
                          <td style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDateTime(r.submitted_at)}</td>
                          {(surveyDetails.questions || []).map((q) => {
                            const val = r.answers?.[String(q.id)]
                            let rendered = '—'
                            if (val !== undefined && val !== null) {
                              if (Array.isArray(val)) rendered = val.join(', ')
                              else rendered = String(val)
                            }
                            return (
                              <td key={q.id} style={{ fontSize: 12 }}>
                                {rendered}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* FARMER PICKER MODAL */}
      {farmerModalOpen && (
        <Modal
          title="Select Specific Farmers"
          description="Pick targeted farmers to receive this disaster survey"
          open={farmerModalOpen}
          size="md"
          onClose={() => setFarmerModalOpen(false)}
        >
          <div style={{ maxHeight: '70vh', minWidth: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label className="search-field">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search by name, phone, district, or farm ID..."
                value={farmerSearch}
                onChange={(e) => setFarmerSearch(e.target.value)}
                autoFocus
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
              <span>{pickedFarmers.length} selected</span>
              {pickedFarmers.length > 0 && (
                <button type="button" className="text-btn" onClick={() => setPickedFarmers([])}>
                  Clear all
                </button>
              )}
            </div>

            <div className="farmer-select-list">
              {loadingFarmers ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Searching farmers…</div>
              ) : availableFarmers.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>No farmers found.</div>
              ) : (
                availableFarmers.map((f) => {
                  const isChecked = pickedFarmers.some((x) => x.farmer_id === f.farmer_id)
                  return (
                    <label key={f.farmer_id} className="farmer-select-row">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPickedFarmers((prev) => [...prev, f])
                          } else {
                            setPickedFarmers((prev) => prev.filter((x) => x.farmer_id !== f.farmer_id))
                          }
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 650, fontSize: 13 }}>{f.full_name}</div>
                        <div style={{ color: 'var(--muted)', fontSize: 11 }}>
                          {f.phone} - {f.district || 'No district'} - {f.farm_id}
                        </div>
                      </div>
                    </label>
                  )
                })
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <Button variant="primary" onClick={() => setFarmerModalOpen(false)}>
                Done ({pickedFarmers.length})
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
