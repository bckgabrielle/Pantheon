import { useEffect, useState } from 'react'
import { createApplication, createJob, createReminder, getApplications, getDashboard, getJobs, getProfile, getReminders, saveProfile } from '../lib/api'

const EMPTY_PROFILE = { headline: '', location: '', skills: [], resume_url: '', preferences: {} }

export default function WorkspacePanel() {
  const [data, setData] = useState(null)
  const [profile, setProfile] = useState(EMPTY_PROFILE)
  const [notice, setNotice] = useState('')
  const [reminder, setReminder] = useState({ message: '', remind_at: '', kind: 'follow_up' })
  const [job, setJob] = useState({ company: '', title: '', url: '', location: '' })
  const [application, setApplication] = useState({ job_id: '', status: 'draft' })

  async function load() {
    const [dashboard, savedProfile, jobs, applications, reminders] = await Promise.all([getDashboard(), getProfile(), getJobs(), getApplications(), getReminders()])
    setData({ dashboard, jobs, applications, reminders })
    setProfile({ ...EMPTY_PROFILE, ...savedProfile })
  }
  useEffect(() => { load().catch((error) => setNotice(error.message)) }, [])

  async function save(e) {
    e.preventDefault()
    await saveProfile({ ...profile, skills: typeof profile.skills === 'string' ? profile.skills.split(',').map((x) => x.trim()).filter(Boolean) : profile.skills })
    setNotice('Profile saved to Pantheon.')
  }
  async function addReminder(e) {
    e.preventDefault()
    await createReminder({ ...reminder, remind_at: new Date(reminder.remind_at).toISOString() })
    setReminder({ message: '', remind_at: '', kind: 'follow_up' })
    setNotice('Reminder stored.')
    load()
  }
  async function addJob(e) { e.preventDefault(); await createJob(job); setJob({ company: '', title: '', url: '', location: '' }); setNotice('Job saved.'); load() }
  async function addApplication(e) { e.preventDefault(); await createApplication({ ...application, job_id: Number(application.job_id) }); setNotice('Application saved.'); load() }

  if (!data) return <div className="empty-state">Loading your saved workspace…{notice && <p>{notice}</p>}</div>
  const metrics = [['Saved jobs', data.dashboard.jobs], ['Applications', data.dashboard.applications], ['Strong matches', data.dashboard.strong_matches], ['Reminders', data.dashboard.pending_reminders]]
  return <div className="workspace-panel">
    <div className="metric-grid">{metrics.map(([label, value]) => <div className="metric" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    <form className="panel-form" onSubmit={save}>
      <div className="section-heading">Career context <span>stored securely in your profile</span></div>
      <input value={profile.headline || ''} placeholder="Professional headline" onChange={(e) => setProfile({ ...profile, headline: e.target.value })} />
      <input value={profile.location || ''} placeholder="Location" onChange={(e) => setProfile({ ...profile, location: e.target.value })} />
      <input value={Array.isArray(profile.skills) ? profile.skills.join(', ') : profile.skills} placeholder="Skills, separated by commas" onChange={(e) => setProfile({ ...profile, skills: e.target.value })} />
      <input value={profile.resume_url || ''} placeholder="Resume URL" onChange={(e) => setProfile({ ...profile, resume_url: e.target.value })} />
      <button className="btn btn-accept" type="submit">Save profile</button>
    </form>
    <form className="panel-form" onSubmit={addReminder}>
      <div className="section-heading">Follow-up reminder</div>
      <input required value={reminder.message} placeholder="What should you return to?" onChange={(e) => setReminder({ ...reminder, message: e.target.value })} />
      <input required type="datetime-local" value={reminder.remind_at} onChange={(e) => setReminder({ ...reminder, remind_at: e.target.value })} />
      <button className="btn btn-accept" type="submit">Create reminder</button>
    </form>
    <form className="panel-form" onSubmit={addJob}>
      <div className="section-heading">Save a job</div>
      <input required value={job.company} placeholder="Company" onChange={(e) => setJob({ ...job, company: e.target.value })} />
      <input required value={job.title} placeholder="Role title" onChange={(e) => setJob({ ...job, title: e.target.value })} />
      <input required type="url" value={job.url} placeholder="Job URL" onChange={(e) => setJob({ ...job, url: e.target.value })} />
      <button className="btn btn-accept" type="submit">Save job</button>
    </form>
    {data.jobs.length > 0 && <form className="panel-form" onSubmit={addApplication}>
      <div className="section-heading">Track an application</div>
      <select value={application.job_id} required onChange={(e) => setApplication({ ...application, job_id: e.target.value })}><option value="">Select a saved job</option>{data.jobs.map((item) => <option value={item.id} key={item.id}>{item.company} — {item.title}</option>)}</select>
      <button className="btn btn-accept" type="submit">Create application</button>
    </form>}
    <div className="stored-list"><div className="section-heading">Saved jobs ({data.jobs.length})</div>{data.jobs.slice(0, 3).map((job) => <div className="stored-item" key={job.id}><strong>{job.title}</strong><span>{job.company} · {job.match_score ?? '—'}% match</span></div>)}{!data.jobs.length && <span>No saved jobs yet.</span>}</div>
    <div className="stored-list"><div className="section-heading">Upcoming reminders ({data.reminders.length})</div>{data.reminders.slice(0, 3).map((item) => <div className="stored-item" key={item.id}><strong>{item.message}</strong><span>{new Date(item.remind_at).toLocaleString()}</span></div>)}{!data.reminders.length && <span>Nothing scheduled.</span>}</div>
    {notice && <div className="notice">{notice}</div>}
  </div>
}
