import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';
import {
    FaBriefcase, FaBuilding, FaMapMarkerAlt, FaDollarSign,
    FaGraduationCap, FaLevelUpAlt, FaCalendarAlt, FaPlus,
    FaTrash, FaSave, FaPaperPlane, FaArrowLeft, FaSync,
    FaExclamationTriangle, FaCheckCircle, FaTimesCircle,
    FaInfoCircle, FaGlobe, FaClock, FaListUl, FaTag
} from 'react-icons/fa';

const ErrorBanner = ({ errors, onDismiss }) => {
    if (!errors || errors.length === 0) return null;
    return (
        <div className="jc-error-banner" role="alert">
            <div className="jc-error-banner__header">
                <FaExclamationTriangle className="jc-error-banner__icon" />
                <div className="jc-error-banner__title">
                    <h4>Unable to save job posting</h4>
                    <p>{errors.length} issue{errors.length > 1 ? 's' : ''} need{errors.length === 1 ? 's' : ''} your attention</p>
                </div>
                <button className="jc-error-banner__close" onClick={onDismiss} aria-label="Dismiss">
                    <FaTimesCircle />
                </button>
            </div>
            <ul className="jc-error-banner__list">
                {errors.map((err, i) => (
                    <li key={i} className="jc-error-banner__item">
                        <FaExclamationTriangle className="jc-error-banner__item-icon" />
                        <div>
                            {err.field && (
                                <span className="jc-error-banner__field">
                                    {err.field.replace(/_/g, ' ')}:{' '}
                                </span>
                            )}
                            <span className="jc-error-banner__message">{err.message || err}</span>
                            {err.availableDepartments && err.availableDepartments.length > 0 && (
                                <div className="jc-error-banner__dept-list">
                                    <p>Try selecting one of these departments:</p>
                                    <ul>
                                        {err.availableDepartments.map((d) => (
                                            <li key={d.id}>{d.name} <small>({d.id})</small></li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const FieldError = ({ message }) => {
    if (!message) return null;
    return (
        <span className="jc-field-error" role="alert">
            <FaExclamationTriangle /> {message}
        </span>
    );
};

const ArrayFieldEditor = ({ label, icon, items, onChange, placeholder }) => {
    const add    = () => onChange([...items, '']);
    const update = (i, v) => { const n = [...items]; n[i] = v; onChange(n); };
    const remove = (i)    => onChange(items.filter((_, idx) => idx !== i));
    return (
        <div className="jc-array-field">
            <div className="jc-array-field__header">
                <label className="jc-label">{icon} {label}</label>
                <button type="button" className="jc-btn-add" onClick={add}><FaPlus /> Add</button>
            </div>
            {items.length === 0 && <p className="jc-array-field__empty">No {label.toLowerCase()} added yet</p>}
            {items.map((item, i) => (
                <div key={i} className="jc-array-field__row">
                    <input type="text" value={item} onChange={(e) => update(i, e.target.value)} placeholder={placeholder} className="jc-input" />
                    <button type="button" className="jc-btn-remove" onClick={() => remove(i)} aria-label="Remove"><FaTrash /></button>
                </div>
            ))}
        </div>
    );
};

const parseServerErrors = (err) => {
    const data = err.response?.data;
    if (!data) return [{ message: err.message || 'An unexpected error occurred' }];
    if (data.error || data.message) {
        return [{ field: data.field || null, message: data.message || data.error, availableDepartments: data.availableDepartments || null }];
    }
    if (Array.isArray(data.errors)) {
        return data.errors.map((e) => ({ field: e.field || null, message: e.message || e.error || String(e) }));
    }
    return [{ message: 'Server error — please try again' }];
};

const JobCreate = () => {
    const navigate  = useNavigate();
    const { id }    = useParams();
    const isEditing = Boolean(id);

    const [formData, setFormData] = useState({
        title: '', department_id: '', employment_type: 'full-time',
        location: '', is_remote: false, salary_min: '', salary_max: '',
        salary_currency: 'ZAR', description: '', requirements: [],
        responsibilities: [], benefits: [], skills_required: [],
        experience_level: '', education_required: '', application_deadline: '', status: 'draft'
    });

    const [departments,    setDepartments]    = useState([]);
    const [loadingDepts,   setLoadingDepts]   = useState(true);
    const [deptFetchError, setDeptFetchError] = useState(null);
    const [loadingJob,     setLoadingJob]     = useState(isEditing);
    const [submitting,     setSubmitting]     = useState(false);
    const [bannerErrors,   setBannerErrors]   = useState([]);
    const [fieldErrors,    setFieldErrors]    = useState({});
    const [activeSection,  setActiveSection]  = useState('basics');

    // ── KEY FIX: fetch departments and normalise to { id, name } using the
    //    real PK (d.id). We accept both old (department_id alias only) and
    //    ml-services (both id + department_id) server responses.
    const fetchDepartments = useCallback(async () => {
        setLoadingDepts(true);
        setDeptFetchError(null);
        try {
            const { data } = await api.get('/hr/departments');
            const raw  = data.data || data.departments || data;
            const list = Array.isArray(raw) ? raw : [];

            if (list.length === 0) {
                setDeptFetchError('No departments found. Please create a department first.');
                setDepartments([]);
                return;
            }

            // Prefer `id` (real PK), fall back to `department_id` (alias).
            // Both will be the same UUID after the backend fix.
            const normalised = list
                .map((d) => ({ id: d.id || d.department_id, name: d.name }))
                .filter((d) => d.id && d.name);

            console.log('✅ Departments loaded:', normalised.map(d => `${d.name}: ${d.id}`));
            setDepartments(normalised);
        } catch (err) {
            console.error('❌ Failed to fetch departments:', err);
            const msg = err.response?.data?.error || 'Failed to load departments. Please try again.';
            setDeptFetchError(msg);
            toast.error(msg);
        } finally {
            setLoadingDepts(false);
        }
    }, []);

    useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

    useEffect(() => {
        if (!isEditing) return;
        const load = async () => {
            setLoadingJob(true);
            try {
                const { data } = await api.get(`/hr/jobs/${id}`);
                const job = data.job || data;
                setFormData({
                    title: job.title || '', department_id: job.department_id || '',
                    employment_type: job.employment_type || 'full-time', location: job.location || '',
                    is_remote: job.is_remote || false, salary_min: job.salary_min ?? '',
                    salary_max: job.salary_max ?? '', salary_currency: job.salary_currency || 'ZAR',
                    description: job.description || '',
                    requirements:     Array.isArray(job.requirements)     ? job.requirements     : [],
                    responsibilities: Array.isArray(job.responsibilities) ? job.responsibilities : [],
                    benefits:         Array.isArray(job.benefits)         ? job.benefits         : [],
                    skills_required:  Array.isArray(job.skills_required)  ? job.skills_required  : [],
                    experience_level: job.experience_level || '', education_required: job.education_required || '',
                    application_deadline: job.application_deadline ? new Date(job.application_deadline).toISOString().split('T')[0] : '',
                    status: job.status || 'draft'
                });
            } catch (err) {
                toast.error('Failed to load job details');
                navigate('/hr/jobs');
            } finally {
                setLoadingJob(false);
            }
        };
        load();
    }, [id, isEditing, navigate]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: null }));
        if (bannerErrors.length) setBannerErrors([]);
    };

    const validate = () => {
        const errs = {};
        if (!formData.title.trim())       errs.title           = 'Job title is required';
        if (!formData.department_id)      errs.department_id   = 'Please select a department';
        if (!formData.employment_type)    errs.employment_type = 'Employment type is required';
        if (!formData.description.trim()) errs.description     = 'Job description is required';
        if (formData.salary_min && formData.salary_max && Number(formData.salary_min) > Number(formData.salary_max)) {
            errs.salary_min = 'Minimum salary cannot be greater than maximum';
        }
        if (formData.department_id && departments.length > 0) {
            const found = departments.find((d) => d.id === formData.department_id);
            if (!found) errs.department_id = 'Selected department is invalid. Please refresh and re-select.';
        }
        return errs;
    };

    const handleSubmit = async (statusOverride) => {
        setBannerErrors([]);
        setFieldErrors({});
        const clientErrs = validate();
        if (Object.keys(clientErrs).length > 0) {
            setFieldErrors(clientErrs);
            setBannerErrors(Object.entries(clientErrs).map(([field, message]) => ({ field, message })));
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                status: statusOverride || formData.status,
                salary_min: formData.salary_min !== '' ? Number(formData.salary_min) : null,
                salary_max: formData.salary_max !== '' ? Number(formData.salary_max) : null,
                application_deadline: formData.application_deadline || null,
                requirements:     formData.requirements.filter(Boolean),
                responsibilities: formData.responsibilities.filter(Boolean),
                benefits:         formData.benefits.filter(Boolean),
                skills_required:  formData.skills_required.filter(Boolean)
            };
            console.log('📤 Submitting:', { department_id: payload.department_id, dept_name: departments.find(d => d.id === payload.department_id)?.name });
            if (isEditing) { await api.patch(`/hr/jobs/${id}`, payload); }
            else           { await api.post('/hr/jobs', payload); }
            toast.success(isEditing ? 'Job updated successfully' : 'Job created successfully');
            navigate('/hr/jobs');
        } catch (err) {
            console.error('❌ Error saving job:', err);
            const serverErrors = parseServerErrors(err);
            setBannerErrors(serverErrors);
            const newFieldErrors = {};
            serverErrors.forEach(({ field, message }) => { if (field) newFieldErrors[field] = message; });
            setFieldErrors(newFieldErrors);
            if (serverErrors.some(e => e.field === 'department_id')) {
                setDeptFetchError('Department list may be stale — click Refresh and re-select.');
            }
            toast.error(serverErrors[0]?.message || 'Failed to save job posting');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingJob) return <Loading />;

    const sections = [
        { id: 'basics', label: 'Basic Info' }, { id: 'details', label: 'Job Details' },
        { id: 'content', label: 'Content' },   { id: 'compensation', label: 'Compensation' }
    ];

    return (
        <div className="jc-page">
            <div className="jc-topbar">
                <button className="jc-back-btn" onClick={() => navigate('/hr/jobs')}><FaArrowLeft /> Back to Jobs</button>
                <h1 className="jc-page-title"><FaBriefcase />{isEditing ? 'Edit Job Posting' : 'Create Job Posting'}</h1>
                <div className="jc-topbar-actions">
                    <button className="jc-btn jc-btn--secondary" onClick={() => handleSubmit('draft')} disabled={submitting}>
                        <FaSave /> {submitting ? 'Saving…' : 'Save Draft'}
                    </button>
                    <button className="jc-btn jc-btn--primary" onClick={() => handleSubmit('open')} disabled={submitting}>
                        <FaPaperPlane /> {submitting ? 'Publishing…' : 'Publish'}
                    </button>
                </div>
            </div>

            <ErrorBanner errors={bannerErrors} onDismiss={() => { setBannerErrors([]); setFieldErrors({}); }} />

            <div className="jc-section-nav">
                {sections.map((s) => (
                    <button key={s.id} type="button"
                            className={`jc-section-nav__btn ${activeSection === s.id ? 'active' : ''}`}
                            onClick={() => setActiveSection(s.id)}>
                        {s.label}
                        {s.id === 'basics'  && (fieldErrors.title || fieldErrors.department_id || fieldErrors.employment_type) && <span className="jc-section-nav__dot" />}
                        {s.id === 'content' && fieldErrors.description && <span className="jc-section-nav__dot" />}
                    </button>
                ))}
            </div>

            <div className="jc-body">
                {activeSection === 'basics' && (
                    <div className="jc-section">
                        <h2 className="jc-section-title">Basic Information</h2>

                        <div className={`jc-field ${fieldErrors.title ? 'jc-field--error' : ''}`}>
                            <label className="jc-label" htmlFor="title">Job Title <span className="jc-required">*</span></label>
                            <input id="title" name="title" type="text" className="jc-input" value={formData.title} onChange={handleChange} placeholder="e.g. Senior Software Engineer" />
                            <FieldError message={fieldErrors.title} />
                        </div>

                        <div className={`jc-field ${fieldErrors.department_id ? 'jc-field--error' : ''}`}>
                            <label className="jc-label" htmlFor="department_id">
                                <FaBuilding /> Department <span className="jc-required">*</span>
                            </label>
                            {loadingDepts ? (
                                <div className="jc-dept-loading"><span className="jc-spinner" /> Loading departments…</div>
                            ) : deptFetchError ? (
                                <div className="jc-dept-error">
                                    <FaExclamationTriangle /><span>{deptFetchError}</span>
                                    <button type="button" className="jc-btn-refresh" onClick={fetchDepartments}><FaSync /> Refresh</button>
                                </div>
                            ) : (
                                <div className="jc-dept-row">
                                    <select id="department_id" name="department_id" className="jc-select" value={formData.department_id} onChange={handleChange}>
                                        <option value="">— Select a department —</option>
                                        {departments.map((dept) => (
                                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                                        ))}
                                    </select>
                                    <button type="button" className="jc-btn-refresh jc-btn-refresh--inline" onClick={fetchDepartments} title="Refresh departments"><FaSync /></button>
                                </div>
                            )}
                            {formData.department_id && !loadingDepts && (
                                <span className="jc-dept-id-preview">
                                    <FaInfoCircle /> {formData.department_id}
                                    {departments.find(d => d.id === formData.department_id)
                                        ? <span className="jc-dept-id-preview--valid"> ✓ valid</span>
                                        : <span className="jc-dept-id-preview--invalid"> ✗ not in list — refresh required</span>}
                                </span>
                            )}
                            <FieldError message={fieldErrors.department_id} />
                        </div>

                        <div className={`jc-field ${fieldErrors.employment_type ? 'jc-field--error' : ''}`}>
                            <label className="jc-label" htmlFor="employment_type"><FaClock /> Employment Type <span className="jc-required">*</span></label>
                            <select id="employment_type" name="employment_type" className="jc-select" value={formData.employment_type} onChange={handleChange}>
                                <option value="full-time">Full Time</option>
                                <option value="part-time">Part Time</option>
                                <option value="contract">Contract</option>
                                <option value="internship">Internship</option>
                                <option value="temporary">Temporary</option>
                            </select>
                            <FieldError message={fieldErrors.employment_type} />
                        </div>

                        <div className="jc-field-row">
                            <div className="jc-field">
                                <label className="jc-label" htmlFor="location"><FaMapMarkerAlt /> Location</label>
                                <input id="location" name="location" type="text" className="jc-input" value={formData.location} onChange={handleChange} placeholder="e.g. Johannesburg" />
                            </div>
                            <div className="jc-field">
                                <label className="jc-label"><FaGlobe /> Remote Option</label>
                                <label className="jc-toggle">
                                    <input id="is_remote" name="is_remote" type="checkbox" checked={formData.is_remote} onChange={handleChange} />
                                    <span className="jc-toggle__track" />
                                    <span className="jc-toggle__label">{formData.is_remote ? 'Remote allowed' : 'On-site only'}</span>
                                </label>
                            </div>
                        </div>

                        <div className="jc-field">
                            <label className="jc-label" htmlFor="application_deadline"><FaCalendarAlt /> Application Deadline</label>
                            <input id="application_deadline" name="application_deadline" type="date" className="jc-input" value={formData.application_deadline} onChange={handleChange} min={new Date().toISOString().split('T')[0]} />
                        </div>
                    </div>
                )}

                {activeSection === 'details' && (
                    <div className="jc-section">
                        <h2 className="jc-section-title">Job Details</h2>
                        <div className="jc-field-row">
                            <div className="jc-field">
                                <label className="jc-label" htmlFor="experience_level"><FaLevelUpAlt /> Experience Level</label>
                                <select id="experience_level" name="experience_level" className="jc-select" value={formData.experience_level} onChange={handleChange}>
                                    <option value="">Not specified</option>
                                    <option value="entry">Entry Level</option>
                                    <option value="junior">Junior (1–2 yrs)</option>
                                    <option value="mid">Mid Level (3–5 yrs)</option>
                                    <option value="senior">Senior (5+ yrs)</option>
                                    <option value="lead">Lead / Principal</option>
                                    <option value="executive">Executive</option>
                                </select>
                            </div>
                            <div className="jc-field">
                                <label className="jc-label" htmlFor="education_required"><FaGraduationCap /> Education Required</label>
                                <select id="education_required" name="education_required" className="jc-select" value={formData.education_required} onChange={handleChange}>
                                    <option value="">Not specified</option>
                                    <option value="none">No formal education</option>
                                    <option value="matric">Matric / Grade 12</option>
                                    <option value="certificate">Certificate / Diploma</option>
                                    <option value="bachelors">Bachelor's Degree</option>
                                    <option value="honours">Honours Degree</option>
                                    <option value="masters">Master's Degree</option>
                                    <option value="phd">PhD / Doctorate</option>
                                </select>
                            </div>
                        </div>
                        <ArrayFieldEditor label="Skills Required" icon={<FaTag />} items={formData.skills_required} onChange={(v) => setFormData((p) => ({ ...p, skills_required: v }))} placeholder="e.g. React, Node.js, PostgreSQL" />
                    </div>
                )}

                {activeSection === 'content' && (
                    <div className="jc-section">
                        <h2 className="jc-section-title">Job Content</h2>
                        <div className={`jc-field ${fieldErrors.description ? 'jc-field--error' : ''}`}>
                            <label className="jc-label" htmlFor="description">Description <span className="jc-required">*</span></label>
                            <textarea id="description" name="description" className="jc-textarea" rows={7} value={formData.description} onChange={handleChange} placeholder="Describe the role and what makes it exciting…" />
                            <FieldError message={fieldErrors.description} />
                        </div>
                        <ArrayFieldEditor label="Responsibilities" icon={<FaListUl />} items={formData.responsibilities} onChange={(v) => setFormData((p) => ({ ...p, responsibilities: v }))} placeholder="e.g. Lead architecture decisions" />
                        <ArrayFieldEditor label="Requirements" icon={<FaCheckCircle />} items={formData.requirements} onChange={(v) => setFormData((p) => ({ ...p, requirements: v }))} placeholder="e.g. 3+ years React experience" />
                        <ArrayFieldEditor label="Benefits" icon={<FaInfoCircle />} items={formData.benefits} onChange={(v) => setFormData((p) => ({ ...p, benefits: v }))} placeholder="e.g. Medical aid, flexible hours" />
                    </div>
                )}

                {activeSection === 'compensation' && (
                    <div className="jc-section">
                        <h2 className="jc-section-title">Compensation</h2>
                        <div className="jc-field">
                            <label className="jc-label" htmlFor="salary_currency"><FaDollarSign /> Currency</label>
                            <select id="salary_currency" name="salary_currency" className="jc-select jc-select--sm" value={formData.salary_currency} onChange={handleChange}>
                                <option value="ZAR">ZAR — South African Rand</option>
                                <option value="USD">USD — US Dollar</option>
                                <option value="EUR">EUR — Euro</option>
                                <option value="GBP">GBP — British Pound</option>
                            </select>
                        </div>
                        <div className="jc-field-row">
                            <div className={`jc-field ${fieldErrors.salary_min ? 'jc-field--error' : ''}`}>
                                <label className="jc-label" htmlFor="salary_min">Min Salary</label>
                                <input id="salary_min" name="salary_min" type="number" className="jc-input" value={formData.salary_min} onChange={handleChange} placeholder="e.g. 400000" min={0} />
                                <FieldError message={fieldErrors.salary_min} />
                            </div>
                            <div className="jc-field">
                                <label className="jc-label" htmlFor="salary_max">Max Salary</label>
                                <input id="salary_max" name="salary_max" type="number" className="jc-input" value={formData.salary_max} onChange={handleChange} placeholder="e.g. 600000" min={0} />
                            </div>
                        </div>
                        {(formData.salary_min || formData.salary_max) && (
                            <div className="jc-salary-preview">
                                <FaInfoCircle /> {formData.salary_currency}{' '}
                                {formData.salary_min ? Number(formData.salary_min).toLocaleString() : '?'}
                                {formData.salary_max ? ` – ${Number(formData.salary_max).toLocaleString()}` : '+'}
                                {' '}per year
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="jc-footer">
                <button type="button" className="jc-btn jc-btn--ghost" onClick={() => navigate('/hr/jobs')} disabled={submitting}>Cancel</button>
                <div className="jc-footer-right">
                    <button type="button" className="jc-btn jc-btn--secondary" onClick={() => handleSubmit('draft')} disabled={submitting}><FaSave /> {submitting ? 'Saving…' : 'Save as Draft'}</button>
                    <button type="button" className="jc-btn jc-btn--primary" onClick={() => handleSubmit('open')} disabled={submitting}><FaPaperPlane /> {submitting ? 'Publishing…' : 'Publish Now'}</button>
                </div>
            </div>

            <style>{`
                .jc-page { min-height:100vh; background:#f0f4f8; padding-bottom:6rem; font-family:'Segoe UI',system-ui,sans-serif; }
                .jc-topbar { display:flex; align-items:center; gap:1.25rem; padding:1.1rem 2rem; background:#fff; border-bottom:1px solid #e2e8f0; position:sticky; top:0; z-index:100; box-shadow:0 1px 4px rgba(0,0,0,0.06); flex-wrap:wrap; }
                .jc-back-btn { display:inline-flex; align-items:center; gap:0.45rem; background:none; border:none; color:#718096; cursor:pointer; font-size:0.875rem; padding:0.4rem 0.7rem; border-radius:6px; transition:all 0.2s; white-space:nowrap; }
                .jc-back-btn:hover { background:#f7fafc; color:#2d3748; }
                .jc-page-title { display:flex; align-items:center; gap:0.55rem; font-size:1.2rem; font-weight:700; color:#2d3748; flex:1; margin:0; min-width:0; }
                .jc-topbar-actions { display:flex; gap:0.6rem; flex-shrink:0; }
                .jc-error-banner { margin:1.25rem 2rem 0; background:#fff5f5; border:1.5px solid #fc8181; border-radius:10px; overflow:hidden; animation:jc-slide-in 0.22s ease; }
                @keyframes jc-slide-in { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
                .jc-error-banner__header { display:flex; align-items:center; gap:0.75rem; padding:0.9rem 1.2rem; background:#fed7d7; }
                .jc-error-banner__icon { color:#c53030; font-size:1.2rem; flex-shrink:0; }
                .jc-error-banner__title { flex:1; }
                .jc-error-banner__title h4 { margin:0 0 0.1rem; color:#742a2a; font-size:0.92rem; font-weight:700; }
                .jc-error-banner__title p  { margin:0; color:#9b2c2c; font-size:0.8rem; }
                .jc-error-banner__close { background:none; border:none; color:#c53030; font-size:1.05rem; cursor:pointer; padding:0.25rem; border-radius:4px; }
                .jc-error-banner__close:hover { background:#feb2b2; }
                .jc-error-banner__list { list-style:none; margin:0; padding:0.6rem 1.2rem 0.8rem; }
                .jc-error-banner__item { display:flex; align-items:flex-start; gap:0.5rem; padding:0.45rem 0; border-bottom:1px solid #fed7d7; font-size:0.875rem; color:#742a2a; }
                .jc-error-banner__item:last-child { border-bottom:none; }
                .jc-error-banner__item-icon { color:#f56565; margin-top:2px; flex-shrink:0; }
                .jc-error-banner__field { font-weight:700; text-transform:capitalize; }
                .jc-error-banner__dept-list { margin-top:0.4rem; padding:0.4rem 0.7rem; background:white; border-radius:5px; font-size:0.8rem; }
                .jc-error-banner__dept-list ul { margin:0.2rem 0 0 1rem; padding:0; }
                .jc-error-banner__dept-list li { margin:0.1rem 0; }
                .jc-error-banner__dept-list small { color:#718096; font-family:monospace; }
                .jc-section-nav { display:flex; background:white; border-bottom:1px solid #e2e8f0; padding:0 2rem; overflow-x:auto; }
                .jc-section-nav__btn { position:relative; padding:0.85rem 1.4rem; background:none; border:none; border-bottom:3px solid transparent; color:#718096; cursor:pointer; font-size:0.875rem; font-weight:500; white-space:nowrap; transition:all 0.2s; }
                .jc-section-nav__btn:hover { color:#4299e1; background:#f7fafc; }
                .jc-section-nav__btn.active { color:#4299e1; border-bottom-color:#4299e1; font-weight:700; }
                .jc-section-nav__dot { position:absolute; top:6px; right:6px; width:7px; height:7px; background:#f56565; border-radius:50%; }
                .jc-body { max-width:820px; margin:1.75rem auto; padding:0 2rem; }
                .jc-section { background:white; border-radius:12px; padding:1.75rem 2rem; box-shadow:0 1px 4px rgba(0,0,0,0.05); }
                .jc-section-title { font-size:1.1rem; font-weight:700; color:#2d3748; margin:0 0 1.5rem; padding-bottom:0.65rem; border-bottom:2px solid #ebf0f7; }
                .jc-field { margin-bottom:1.3rem; display:flex; flex-direction:column; gap:0.3rem; }
                .jc-field--error .jc-input, .jc-field--error .jc-select, .jc-field--error .jc-textarea { border-color:#fc8181 !important; box-shadow:0 0 0 3px rgba(252,129,129,0.15); }
                .jc-field-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
                @media(max-width:600px){.jc-field-row{grid-template-columns:1fr}}
                .jc-label { font-size:0.845rem; font-weight:600; color:#4a5568; display:flex; align-items:center; gap:0.35rem; }
                .jc-required { color:#f56565; }
                .jc-input,.jc-select,.jc-textarea { width:100%; padding:0.62rem 0.85rem; border:1.5px solid #e2e8f0; border-radius:8px; font-size:0.9rem; color:#2d3748; background:white; transition:border-color 0.2s,box-shadow 0.2s; box-sizing:border-box; }
                .jc-input:focus,.jc-select:focus,.jc-textarea:focus { outline:none; border-color:#4299e1; box-shadow:0 0 0 3px rgba(66,153,225,0.15); }
                .jc-select--sm { max-width:260px; }
                .jc-textarea { resize:vertical; line-height:1.6; }
                .jc-field-error { display:flex; align-items:center; gap:0.3rem; font-size:0.78rem; color:#e53e3e; font-weight:600; }
                .jc-dept-loading { display:flex; align-items:center; gap:0.6rem; padding:0.62rem 0.85rem; background:#f7fafc; border:1.5px solid #e2e8f0; border-radius:8px; color:#718096; font-size:0.875rem; }
                .jc-spinner { width:15px; height:15px; border:2px solid #e2e8f0; border-top-color:#4299e1; border-radius:50%; display:inline-block; animation:jc-spin 0.55s linear infinite; }
                @keyframes jc-spin{to{transform:rotate(360deg)}}
                .jc-dept-error { display:flex; align-items:center; gap:0.5rem; padding:0.65rem 0.85rem; background:#fff5f5; border:1.5px solid #fc8181; border-radius:8px; color:#c53030; font-size:0.845rem; flex-wrap:wrap; }
                .jc-dept-error svg { flex-shrink:0; }
                .jc-dept-error span { flex:1; }
                .jc-dept-row { display:flex; align-items:center; gap:0.5rem; }
                .jc-dept-row .jc-select { flex:1; }
                .jc-btn-refresh { display:inline-flex; align-items:center; gap:0.35rem; padding:0.4rem 0.8rem; background:#ebf8ff; border:1px solid #bee3f8; border-radius:6px; color:#2b6cb0; font-size:0.8rem; font-weight:600; cursor:pointer; white-space:nowrap; transition:background 0.2s; }
                .jc-btn-refresh:hover { background:#bee3f8; }
                .jc-btn-refresh--inline { padding:0.62rem 0.75rem; flex-shrink:0; }
                .jc-dept-id-preview { display:flex; align-items:center; gap:0.3rem; font-size:0.75rem; color:#718096; font-family:monospace; padding:0.15rem 0; }
                .jc-dept-id-preview--valid   { color:#38a169; font-weight:600; }
                .jc-dept-id-preview--invalid { color:#e53e3e; font-weight:600; }
                .jc-toggle { display:flex; align-items:center; gap:0.6rem; cursor:pointer; user-select:none; margin-top:0.3rem; }
                .jc-toggle input { display:none; }
                .jc-toggle__track { width:40px; height:22px; border-radius:11px; background:#cbd5e0; position:relative; transition:background 0.22s; flex-shrink:0; }
                .jc-toggle__track::after { content:''; position:absolute; top:3px; left:3px; width:16px; height:16px; border-radius:50%; background:white; transition:transform 0.22s; box-shadow:0 1px 3px rgba(0,0,0,0.2); }
                .jc-toggle input:checked ~ .jc-toggle__track { background:#48bb78; }
                .jc-toggle input:checked ~ .jc-toggle__track::after { transform:translateX(18px); }
                .jc-toggle__label { font-size:0.875rem; color:#4a5568; }
                .jc-array-field { margin-bottom:1.5rem; }
                .jc-array-field__header { display:flex; align-items:center; justify-content:space-between; margin-bottom:0.5rem; }
                .jc-array-field__empty { font-size:0.82rem; color:#a0aec0; font-style:italic; padding:0.3rem 0; }
                .jc-array-field__row { display:flex; gap:0.5rem; margin-bottom:0.4rem; }
                .jc-btn-add { display:inline-flex; align-items:center; gap:0.3rem; padding:0.3rem 0.7rem; background:#ebf8ff; color:#2b6cb0; border:1px solid #bee3f8; border-radius:6px; font-size:0.78rem; font-weight:600; cursor:pointer; }
                .jc-btn-add:hover { background:#bee3f8; }
                .jc-btn-remove { width:36px; height:36px; flex-shrink:0; background:#fff5f5; border:1px solid #fed7d7; border-radius:7px; color:#f56565; cursor:pointer; display:flex; align-items:center; justify-content:center; }
                .jc-btn-remove:hover { background:#fed7d7; }
                .jc-salary-preview { display:flex; align-items:center; gap:0.45rem; padding:0.65rem 0.9rem; background:#f0fff4; border:1px solid #9ae6b4; border-radius:8px; color:#276749; font-size:0.875rem; font-weight:500; margin-top:0.4rem; }
                .jc-btn { display:inline-flex; align-items:center; gap:0.4rem; padding:0.58rem 1.15rem; border-radius:8px; font-size:0.875rem; font-weight:600; cursor:pointer; border:none; transition:all 0.2s; white-space:nowrap; }
                .jc-btn:disabled { opacity:0.55; cursor:not-allowed; }
                .jc-btn--primary { background:#4299e1; color:white; }
                .jc-btn--primary:hover:not(:disabled) { background:#3182ce; }
                .jc-btn--secondary { background:white; color:#2d3748; border:1.5px solid #e2e8f0; }
                .jc-btn--secondary:hover:not(:disabled) { background:#f7fafc; border-color:#cbd5e0; }
                .jc-btn--ghost { background:transparent; color:#718096; border:1.5px solid transparent; }
                .jc-btn--ghost:hover:not(:disabled) { background:#f7fafc; color:#2d3748; }
                .jc-footer { position:fixed; bottom:0; left:0; right:0; background:white; border-top:1px solid #e2e8f0; padding:0.85rem 2rem; display:flex; align-items:center; justify-content:space-between; z-index:100; box-shadow:0 -4px 12px rgba(0,0,0,0.06); }
                .jc-footer-right { display:flex; gap:0.6rem; }
                @media(max-width:600px){.jc-topbar{padding:0.85rem 1rem}.jc-topbar-actions{width:100%;justify-content:flex-end}.jc-error-banner{margin:0.75rem 1rem 0}.jc-section-nav{padding:0 1rem}.jc-body{padding:0 1rem}.jc-section{padding:1.25rem}.jc-footer{padding:0.75rem 1rem}}
            `}</style>
        </div>
    );
};

export default JobCreate;