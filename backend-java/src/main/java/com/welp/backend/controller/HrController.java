package com.welp.backend.controller;

import com.welp.backend.dto.CreateJobPostingRequest;
import com.welp.backend.dto.UpdateJobPostingRequest;
import com.welp.backend.service.HrService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/hr")
public class HrController {

    private final HrService hrService;

    public HrController(HrService hrService) {
        this.hrService = hrService;
    }

    @PostMapping("/job-postings")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createJobPosting(
            @Valid @RequestBody CreateJobPostingRequest request,
            @RequestHeader("X-User-Id") UUID userId
    ) {
        return hrService.createJobPosting(request, userId);
    }

    @PatchMapping("/job-postings/{id}")
    public Map<String, Object> updateJobPosting(
            @PathVariable UUID id,
            @RequestBody UpdateJobPostingRequest request
    ) {
        return hrService.updateJobPosting(id, request);
    }

    @GetMapping("/departments")
    public List<Map<String, Object>> getDepartments() {
        return hrService.getDepartments();
    }
}
