import api from './api';

const extractRegistrationError = (error) => {
    return (
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Registration failed'
    );
};

export const registerEmployee = async (payload) => {
    try {
        const { data } = await api.post('/auth/register', payload);
        return data;
    } catch (error) {
        throw new Error(extractRegistrationError(error));
    }
};

export const registerBusiness = async (payload) => {
    try {
        const { data } = await api.post('/auth/register/business', payload);
        return data;
    } catch (error) {
        throw new Error(extractRegistrationError(error));
    }
};

export const registerPsychologist = async (payload) => {
    try {
        const { data } = await api.post('/auth/register/psychologist', payload);
        return data;
    } catch (error) {
        throw new Error(extractRegistrationError(error));
    }
};

