
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { motion } from 'framer-motion';
import {
    FaShieldAlt,
    FaArrowLeft,
    FaArrowRight,
    FaBuilding,
    FaFileContract,
    FaIdCard,
    FaCheckCircle,
    FaUpload
} from 'react-icons/fa';
import Loading from '../components/common/Loading';
import toast from 'react-hot-toast';

const KYCRegistration = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        registrationNumber: '',
        businessType: '',
        yearEstablished: '',
        legalRepresentative: '',
        representativeIdNumber: ''
    });

    useEffect(() => {
        if (id) {
            fetchCompany();
        }
    }, [id]);

    const fetchCompany = async () => {
        try {
            const { data } = await api.get(`/companies/${id}`);
            setCompany(data);
        } catch (error) {
            toast.error('Failed to load company details');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = () => {
        toast.success('KYC application submitted successfully!');
        navigate('/dashboard');
    };

    if (loading) return <Loading />;

    return (
        <div className="kyc-page">
            <div className="kyc-header">
                <div className="container">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <h1>
                            <FaShieldAlt /> Verify Your Business
                        </h1>
                        <p>Complete KYC verification for {company?.name || 'your business'}</p>
                    </motion.div>
                </div>
            </div>

            <div className="container">
                <div className="kyc-content">
                    {}
                    <div className="kyc-steps">
                        <div className={`step ${step >= 1 ? 'active' : ''}`}>
                            <div className="step-number">1</div>
                            <div className="step-label">Business Info</div>
                        </div>
                        <div className="step-connector"></div>
                        <div className={`step ${step >= 2 ? 'active' : ''}`}>
                            <div className="step-number">2</div>
                            <div className="step-label">Representative</div>
                        </div>
                        <div className="step-connector"></div>
                        <div className={`step ${step >= 3 ? 'active' : ''}`}>
                            <div className="step-number">3</div>
                            <div className="step-label">Documents</div>
                        </div>
                    </div>

                    <div className="kyc-form">
                        {step === 1 && (
                            <div>
                                <h2>Business Information</h2>
                                <p>Enter your company registration details</p>

                                <div className="form-group">
                                    <label>Company Name</label>
                                    <input type="text" value={company?.name || ''} disabled />
                                </div>

                                <div className="form-group">
                                    <label>Registration Number *</label>
                                    <input
                                        type="text"
                                        value={formData.registrationNumber}
                                        onChange={(e) => setFormData({...formData, registrationNumber: e.target.value})}
                                        placeholder="e.g., 2023/123456/07"
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Business Type *</label>
                                        <select
                                            value={formData.businessType}
                                            onChange={(e) => setFormData({...formData, businessType: e.target.value})}
                                        >
                                            <option value="">Select type</option>
                                            <option value="Private Limited Company">Private Limited Company</option>
                                            <option value="Public Limited Company">Public Limited Company</option>
                                            <option value="Sole Proprietorship">Sole Proprietorship</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Year Established *</label>
                                        <input
                                            type="number"
                                            value={formData.yearEstablished}
                                            onChange={(e) => setFormData({...formData, yearEstablished: e.target.value})}
                                            placeholder="YYYY"
                                        />
                                    </div>
                                </div>

                                <button onClick={() => setStep(2)} className="btn btn-primary">
                                    Continue <FaArrowRight />
                                </button>
                            </div>
                        )}

                        {step === 2 && (
                            <div>
                                <h2>Legal Representative</h2>
                                <p>Information of the person authorized to represent this business</p>

                                <div className="form-group">
                                    <label>Full Name *</label>
                                    <input
                                        type="text"
                                        value={formData.legalRepresentative}
                                        onChange={(e) => setFormData({...formData, legalRepresentative: e.target.value})}
                                        placeholder="As appears on ID"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>ID/Passport Number *</label>
                                    <input
                                        type="text"
                                        value={formData.representativeIdNumber}
                                        onChange={(e) => setFormData({...formData, representativeIdNumber: e.target.value})}
                                        placeholder="ID or Passport number"
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button onClick={() => setStep(1)} className="btn btn-secondary">
                                        <FaArrowLeft /> Back
                                    </button>
                                    <button onClick={() => setStep(3)} className="btn btn-primary">
                                        Continue <FaArrowRight />
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div>
                                <h2>Document Upload</h2>
                                <p>Upload required verification documents</p>

                                <div className="document-section">
                                    <h3>Certificate of Registration *</h3>
                                    <div className="upload-area">
                                        <input type="file" id="registration" style={{ display: 'none' }} />
                                        <label htmlFor="registration" className="upload-label">
                                            <FaUpload /> Click to upload
                                        </label>
                                    </div>
                                </div>

                                <div className="document-section">
                                    <h3>ID Document *</h3>
                                    <div className="upload-area">
                                        <input type="file" id="id" style={{ display: 'none' }} />
                                        <label htmlFor="id" className="upload-label">
                                            <FaUpload /> Click to upload
                                        </label>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button onClick={() => setStep(2)} className="btn btn-secondary">
                                        <FaArrowLeft /> Back
                                    </button>
                                    <button onClick={handleSubmit} className="btn btn-primary">
                                        Submit Application
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {}
                    <div className="kyc-sidebar">
                        <div className="info-card">
                            <h3><FaShieldAlt /> Why KYC?</h3>
                            <ul>
                                <li>- Verify business authenticity</li>
                                <li>- Prevent fraud</li>
                                <li>- Build trust</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KYCRegistration;