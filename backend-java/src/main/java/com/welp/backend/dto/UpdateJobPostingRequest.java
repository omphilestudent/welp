package com.welp.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record UpdateJobPostingRequest(
        String title,
        UUID department_id,
        String employment_type,
        String location,
        Boolean is_remote,
        BigDecimal salary_min,
        BigDecimal salary_max,
        String salary_currency,
        String description,
        List<String> requirements,
        List<String> responsibilities,
        List<String> benefits,
        List<String> skills_required,
        String experience_level,
        String education_required,
        LocalDate application_deadline,
        String status
) {}
