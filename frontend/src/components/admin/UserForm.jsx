import React, { useState } from 'react';
import './UserForm.css';

const UserForm = ({ user, roles, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({
        email: user?.email || '',
        password: '',
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        role: user?.role || user?.roleId || '',
        department: user?.department || '',
        phoneNumber: user?.phoneNumber || '',
        isActive: user?.isActive ?? true
    });

    const [errors, setErrors] = useState({});

    const departments = [
        'Engineering', 'Product', 'Sales', 'Marketing', 'Customer Support',
        'Human Resources', 'Finance', 'Operations', 'Data Science',
        'Research & Development', 'Legal', 'Administration'
    ];

    const validateForm = () => {
        const newErrors = {};

        if (!formData.email) newErrors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';

        if (!user && !formData.password) newErrors.password = 'Password is required for new users';
        else if (formData.password && formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';

        if (!formData.firstName) newErrors.firstName = 'First name is required';
        if (!formData.lastName) newErrors.lastName = 'Last name is required';
        if (!formData.role) newErrors.role = 'Role is required';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (validateForm()) {
            onSubmit(formData);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="user-form">
            <div className="form-row">
                <div className="form-group">
                    <label htmlFor="firstName">First Name *</label>
                    <input type="text" id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} className={errors.firstName ? 'error' : ''} />
                    {errors.firstName && <span className="error-message">{errors.firstName}</span>}
                </div>
                <div className="form-group">
                    <label htmlFor="lastName">Last Name *</label>
                    <input type="text" id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} className={errors.lastName ? 'error' : ''} />
                    {errors.lastName && <span className="error-message">{errors.lastName}</span>}
                </div>
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label htmlFor="email">Email *</label>
                    <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className={errors.email ? 'error' : ''} />
                    {errors.email && <span className="error-message">{errors.email}</span>}
                </div>

                {!user && (
                    <div className="form-group">
                        <label htmlFor="password">Password *</label>
                        <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} className={errors.password ? 'error' : ''} />
                        {errors.password && <span className="error-message">{errors.password}</span>}
                    </div>
                )}
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label htmlFor="role">Role *</label>
                    <select id="role" name="role" value={formData.role} onChange={handleChange} className={errors.role ? 'error' : ''}>
                        <option value="">Select a role</option>
                        {roles.map((role) => (
                            <option key={role.name || role.id} value={role.name || role.id}>{role.name} - {role.description || ''}</option>
                        ))}
                    </select>
                    {errors.role && <span className="error-message">{errors.role}</span>}
                </div>

                <div className="form-group">
                    <label htmlFor="department">Department</label>
                    <select id="department" name="department" value={formData.department} onChange={handleChange}>
                        <option value="">Select department</option>
                        {departments.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                    </select>
                </div>
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label htmlFor="phoneNumber">Phone Number</label>
                    <input type="tel" id="phoneNumber" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="+1234567890" />
                </div>

                <div className="form-group checkbox-group">
                    <label>
                        <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} /> Active Account
                    </label>
                </div>
            </div>

            <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn-primary">{user ? 'Update User' : 'Create User'}</button>
            </div>
        </form>
    );
};

export default UserForm;
