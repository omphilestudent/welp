package com.welp.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.welp.backend.dto.CreateJobPostingRequest;
import com.welp.backend.dto.UpdateJobPostingRequest;
import org.postgresql.util.PGobject;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.*;

@Service
public class HrService {
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public HrService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> createJobPosting(CreateJobPostingRequest req, UUID userId) {
        UUID postedBy = resolvePostedBy(userId);

        String sql = """
                INSERT INTO job_postings (
                    title, department_id, employment_type, location, is_remote,
                    salary_min, salary_max, salary_currency, description,
                    requirements, responsibilities, benefits, skills_required,
                    experience_level, education_required, application_deadline,
                    status, posted_by
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb,
                    ?, ?, ?, ?, ?
                ) RETURNING *
                """;

        String status = req.status() == null || req.status().isBlank() ? "draft" : req.status();

        return jdbcTemplate.queryForMap(sql,
                req.title(), req.department_id(), req.employment_type(), req.location(),
                req.is_remote() != null && req.is_remote(), req.salary_min(), req.salary_max(),
                req.salary_currency() == null ? "USD" : req.salary_currency(), req.description(),
                toJsonb(req.requirements()), toJsonb(req.responsibilities()), toJsonb(req.benefits()), toJsonb(req.skills_required()),
                req.experience_level(), req.education_required(),
                req.application_deadline() == null ? null : Date.valueOf(req.application_deadline()),
                status, postedBy
        );
    }

    public Map<String, Object> updateJobPosting(UUID id, UpdateJobPostingRequest req) {
        Map<String, Object> updates = new LinkedHashMap<>();
        putIfNotNull(updates, "title", req.title());
        putIfNotNull(updates, "department_id", req.department_id());
        putIfNotNull(updates, "employment_type", req.employment_type());
        putIfNotNull(updates, "location", req.location());
        putIfNotNull(updates, "is_remote", req.is_remote());
        putIfNotNull(updates, "salary_min", req.salary_min());
        putIfNotNull(updates, "salary_max", req.salary_max());
        putIfNotNull(updates, "salary_currency", req.salary_currency());
        putIfNotNull(updates, "description", req.description());
        if (req.requirements() != null) updates.put("requirements::jsonb", toJsonb(req.requirements()));
        if (req.responsibilities() != null) updates.put("responsibilities::jsonb", toJsonb(req.responsibilities()));
        if (req.benefits() != null) updates.put("benefits::jsonb", toJsonb(req.benefits()));
        if (req.skills_required() != null) updates.put("skills_required::jsonb", toJsonb(req.skills_required()));
        putIfNotNull(updates, "experience_level", req.experience_level());
        putIfNotNull(updates, "education_required", req.education_required());
        if (req.application_deadline() != null) updates.put("application_deadline", Date.valueOf(req.application_deadline()));
        putIfNotNull(updates, "status", req.status());

        if (updates.isEmpty()) throw new IllegalArgumentException("No fields to update");

        List<Object> params = new ArrayList<>();
        StringBuilder setClause = new StringBuilder();
        int i = 1;
        for (var entry : updates.entrySet()) {
            if (!setClause.isEmpty()) setClause.append(", ");
            String key = entry.getKey();
            if (key.endsWith("::jsonb")) {
                String col = key.replace("::jsonb", "");
                setClause.append(col).append(" = ?::jsonb");
            } else {
                setClause.append(key).append(" = ?");
            }
            params.add(entry.getValue());
            i++;
        }
        setClause.append(", updated_at = CURRENT_TIMESTAMP");
        params.add(id);

        String sql = "UPDATE job_postings SET " + setClause + " WHERE id = ? RETURNING *";
        var rows = jdbcTemplate.queryForList(sql, params.toArray());
        if (rows.isEmpty()) throw new NoSuchElementException("Job not found");
        return rows.get(0);
    }

    public List<Map<String, Object>> getDepartments() {
        Boolean exists = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables WHERE table_name = 'departments'
                )
                """, Boolean.class);

        if (Boolean.FALSE.equals(exists)) return defaultDepartments();

        boolean hasDeptId = Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'department_id'
                )
                """, Boolean.class));
        boolean hasDept = Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'department'
                )
                """, Boolean.class));

        String employeeExpr = "0";
        if (hasDeptId) employeeExpr = "(SELECT COUNT(*) FROM users WHERE department_id = d.id)";
        else if (hasDept) employeeExpr = "(SELECT COUNT(*) FROM users WHERE department = d.name)";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT d.*, u.display_name as manager_name,
                       """ + employeeExpr + """ as employee_count
                FROM departments d
                LEFT JOIN users u ON d.manager_id = u.id
                ORDER BY d.name
                """);

        return rows.isEmpty() ? defaultDepartments() : rows;
    }

    private UUID resolvePostedBy(UUID userId) {
        List<Map<String, Object>> fk = jdbcTemplate.queryForList("""
                SELECT ccu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.constraint_column_usage ccu
                  ON tc.constraint_name = ccu.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_name = 'job_postings'
                  AND tc.constraint_name = 'job_postings_posted_by_fkey'
                LIMIT 1
                """);

        String refColumn = fk.isEmpty() ? "id" : String.valueOf(fk.get(0).get("column_name"));

        List<Map<String, Object>> admins = jdbcTemplate.queryForList(
                "SELECT id, user_id FROM admin_users WHERE user_id = ? OR id = ? LIMIT 1",
                userId, userId
        );
        if (admins.isEmpty()) throw new SecurityException("User is not an admin");

        Object val = "user_id".equals(refColumn) ? admins.get(0).get("user_id") : admins.get(0).get("id");
        return UUID.fromString(String.valueOf(val));
    }

    private PGobject toJsonb(List<String> values) {
        try {
            PGobject pg = new PGobject();
            pg.setType("jsonb");
            pg.setValue(objectMapper.writeValueAsString(values == null ? List.of() : values));
            return pg;
        } catch (JsonProcessingException | java.sql.SQLException e) {
            throw new IllegalArgumentException("Invalid JSON field", e);
        }
    }

    private void putIfNotNull(Map<String, Object> map, String key, Object value) {
        if (value != null) map.put(key, value);
    }

    private List<Map<String, Object>> defaultDepartments() {
        return List.of(
                Map.of("id", UUID.fromString("5f8f6f2e-1d4a-4c7a-9b11-1a2b3c4d5e61"), "name", "General"),
                Map.of("id", UUID.fromString("6a9c2d10-3f44-4b90-a4d3-2b3c4d5e6f72"), "name", "Engineering"),
                Map.of("id", UUID.fromString("7b1d3e21-5a66-4f83-b5e4-3c4d5e6f7a83"), "name", "Product"),
                Map.of("id", UUID.fromString("8c2e4f32-6b78-42a1-8c95-4d5e6f7a8b94"), "name", "Design"),
                Map.of("id", UUID.fromString("9d3f5a43-7c8a-4d2b-9da6-5e6f7a8b9ca5"), "name", "Marketing"),
                Map.of("id", UUID.fromString("ae4a6b54-8d9c-4e3c-aeb7-6f7a8b9cadb6"), "name", "Sales"),
                Map.of("id", UUID.fromString("bf5b7c65-9e0f-4f4d-bfc8-7a8b9cadbec7"), "name", "Human Resources"),
                Map.of("id", UUID.fromString("c06c8d76-af12-4a5e-80d9-8b9cadbecfd8"), "name", "Finance"),
                Map.of("id", UUID.fromString("d17d9e87-b234-4b6f-91ea-9cadbecfd0e9"), "name", "Operations")
        );
    }
}
