package in.schemesetu.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final ObjectMapper json = new ObjectMapper();
    private final SupabaseService database;
    private List<Map<String, Object>> schemes = List.of();
    private final RestClient http = RestClient.create();

    @Value("${NVIDIA_API_KEY:}")
    private String nvidiaKey;

    @Value("${NVIDIA_MODEL:nvidia/nemotron-3.5-lightning-30b-a3b}")
    private String nvidiaModel;

    public ApiController(SupabaseService database) {
        this.database = database;
    }

    @PostConstruct
    void loadCatalog() throws Exception {
        try (InputStream input = new ClassPathResource("local-schemes.json").getInputStream()) {
            schemes = json.readValue(input, new TypeReference<>() {});
        }
    }

    @GetMapping("/health")
    Map<String, Object> health() {
        return Map.of("ok", true, "databaseConfigured", database.isConfigured(), "aiConfigured", !clean(nvidiaKey).isBlank());
    }

    @GetMapping("/scholarships")
    Map<String, Object> search(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String level,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "deadline") String sort,
            @RequestParam(required = false) String education,
            @RequestParam(required = false) String course,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Double minAmount) {
        if (page < 1 || !List.of(20, 50, 100).contains(pageSize)
                || !List.of("deadline", "name", "updated", "amount").contains(sort)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid search parameters");
        }

        if (database.isConfigured()) {
            try {
                Map<String, String> filters = new LinkedHashMap<>();
                filters.put("verification_status", "in.(verified,outdated)");
                if (q != null && !q.isBlank()) filters.put("search_document", "websearch.q." + q);
                if (level != null && !level.isBlank()) filters.put("government_level", "eq." + level);
                if (state != null && !state.isBlank()) filters.put("state_name", "eq." + state);
                if (status != null && !status.isBlank()) filters.put("application_status", "eq." + status);
                if (education != null && !education.isBlank()) filters.put("education_levels", "cs.{" + education + "}");
                if (course != null && !course.isBlank()) filters.put("eligible_courses", "cs.{" + course + "}");
                if (category != null && !category.isBlank()) filters.put("target_categories", "cs.{" + category + "}");
                if (minAmount != null) filters.put("amount_max", "gte." + minAmount);
                String column = switch (sort) {
                    case "name" -> "name";
                    case "updated" -> "updated_at";
                    case "amount" -> "amount_max";
                    default -> "application_end";
                };
                boolean ascending = sort.equals("name") || sort.equals("deadline");
                filters.put("order", column + (ascending ? ".asc" : ".desc") + ".nullslast");
                JsonNode rows = database.select("scholarships", filters,
                        "id,name,summary,government_level,state_name,category,education_levels,amount_min,amount_max,application_start,application_end,application_status,verification_status,official_url,last_verified_at",
                        (page - 1) * pageSize, page * pageSize - 1, true);
                long total = database.count("scholarships", filters);
                if (rows != null && rows.isArray() && !rows.isEmpty() && total > 0) {
                    return Map.of("data", json.convertValue(rows, new TypeReference<List<Map<String, Object>>>() {}),
                            "total", total, "page", page, "pageSize", pageSize,
                            "totalPages", (int) Math.ceil((double) total / pageSize));
                }
            } catch (Exception ignored) {
                // Fall back to the bundled catalog when Supabase is unreachable.
            }
        }

        List<Map<String, Object>> matches = schemes.stream()
                .filter(s -> containsAllWords(searchableText(s), q))
                .filter(s -> equalsIfSet(s.get("government_level"), level))
                .filter(s -> equalsIfSet(s.get("state_name"), state))
                .filter(s -> equalsIfSet(s.get("application_status"), status))
                .filter(s -> containsValue(s.get("education_levels"), education))
                .filter(s -> containsAnyText(s.get("eligible_courses"), course))
                .filter(s -> containsValue(s.get("target_categories"), category))
                .filter(s -> minAmount == null || number(s.get("amount_max")) >= minAmount)
                .sorted(comparator(sort))
                .toList();

        int start = Math.min((page - 1) * pageSize, matches.size());
        int end = Math.min(start + pageSize, matches.size());
        List<Map<String, Object>> rows = matches.subList(start, end).stream()
                .map(this::searchSummary).toList();

        return Map.of("data", rows, "total", matches.size(), "page", page,
                "pageSize", pageSize, "totalPages", (int) Math.ceil((double) matches.size() / pageSize),
                "source", "local sample catalog");
    }

    @GetMapping("/scholarships/{id}")
    Map<String, Object> details(@PathVariable String id) {
        if (database.isConfigured()) {
            try {
                JsonNode result = database.select("scholarships", Map.of(
                                "id", "eq." + id,
                                "verification_status", "in.(verified,outdated)",
                                "limit", "1"),
                        "id,name,summary,description,category,government_level,state_name,department,target_categories,education_levels,eligible_courses,academic_year,min_age,max_age,annual_income_limit,min_percentage,gender_requirements,caste_requirements,disability_requirement,institution_requirements,other_conditions,amount_min,amount_max,benefits,application_start,application_end,required_documents,application_procedure,renewal_conditions,official_url,information_source_url,last_verified_at,application_status,verification_status,source_registry(name,source_url)",
                        0, 0, false);
                if (result != null && result.isArray() && !result.isEmpty()) {
                    Map<String, Object> scheme = database.asMap(result.get(0));
                    JsonNode rules = database.select("scholarship_eligibility_rules",
                            Map.of("scholarship_id", "eq." + id),
                            "field_name,operator,expected_value,is_required,source_note,criterion_type,criterion_value,is_mandatory,condition_group,condition_operator,group_operator,academic_year,source_url,verification_status,last_verified_at",
                            0, 999, false);
                    JsonNode docs = database.select("scholarship_documents",
                            Map.of("scholarship_id", "eq." + id),
                            "document_name,requirement_type,format_requirements,validity_requirements,condition_text",
                            0, 999, false);
                    scheme.put("eligibility_rules", rules == null ? List.of()
                            : json.convertValue(rules, new TypeReference<List<Map<String, Object>>>() {}));
                    scheme.put("documents", docs == null ? List.of()
                            : json.convertValue(docs, new TypeReference<List<Map<String, Object>>>() {}));
                    return scheme;
                }
            } catch (Exception ignored) {
                // Try the bundled catalog when Supabase has no usable matching record.
            }
        }
        return schemes.stream().filter(s -> id.equals(s.get("id"))).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Scholarship not found."));
    }

    @GetMapping("/eligibility/schemes")
    List<Map<String, Object>> eligibilitySchemes() {
        if (database.isConfigured()) {
            try {
                JsonNode rows = database.selectAll("scholarships", Map.of(
                                "verification_status", "in.(verified,outdated)", "order", "name.asc"),
                        "id,name,summary,description,government_level,state_name,department,category,target_categories,education_levels,eligible_courses,academic_year,min_age,max_age,annual_income_limit,min_percentage,gender_requirements,caste_requirements,disability_requirement,institution_requirements,other_conditions,amount_min,amount_max,benefits,application_start,application_end,application_status,verification_status,required_documents,application_procedure,renewal_conditions,official_url,information_source_url,last_verified_at",
                        500);
                if (rows != null && rows.isArray() && !rows.isEmpty()) {
                    List<Map<String, Object>> records = json.convertValue(rows,
                            new TypeReference<List<Map<String, Object>>>() {});
                    for (Map<String, Object> record : records) {
                        JsonNode rules = database.select("scholarship_eligibility_rules",
                                Map.of("scholarship_id", "eq." + record.get("id")),
                                "field_name,operator,expected_value,is_required,source_note,criterion_type,criterion_value,is_mandatory,condition_group,condition_operator,group_operator,academic_year,source_url,verification_status,last_verified_at",
                                0, 999, false);
                        record.put("eligibility_rules", rules == null ? List.of()
                                : json.convertValue(rules, new TypeReference<List<Map<String, Object>>>() {}));
                    }
                    return records;
                }
            } catch (Exception ignored) {
                // Keep the eligibility checker available from the local catalog.
            }
        }
        return schemes;
    }

    @GetMapping("/coverage")
    Map<String, Object> coverage() {
        if (database.isConfigured()) {
            try {
                Map<String, Object> counts = new LinkedHashMap<>();
                counts.put("total", database.count("scholarships", Map.of()));
                counts.put("central", database.count("scholarships", Map.of("government_level", "eq.central")));
                counts.put("state", database.count("scholarships", Map.of("government_level", "eq.state")));
                counts.put("ut", database.count("scholarships", Map.of("government_level", "eq.ut")));
                counts.put("verified", database.count("scholarships", Map.of("verification_status", "eq.verified")));
                counts.put("pending", database.count("scholarships", Map.of("verification_status", "eq.pending")));
                counts.put("open", database.count("scholarships", Map.of("application_status", "eq.open")));
                counts.put("expired", database.count("scholarships", Map.of("application_status", "eq.closed")));
                JsonNode sources = database.select("source_registry", Map.of(),
                        "id,name,government_level,region_name,is_active,last_checked_at,last_status,crawl_permitted",
                        0, 999, false);
                return Map.of("configured", true, "coverage", counts,
                        "sources", sources == null ? List.of()
                                : json.convertValue(sources, new TypeReference<List<Map<String, Object>>>() {}));
            } catch (Exception ignored) {
                // Report local mode when the database is unavailable.
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("configured", false);
        result.put("coverage", null);
        return result;
    }

    @PostMapping("/assistant")
    Map<String, Object> assistant(@RequestBody Map<String, String> body) {
        String question = body.getOrDefault("question", "").trim();
        if (question.length() < 4 || question.length() > 2000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Ask a question between 4 and 2,000 characters.");
        }

        boolean greeting = question.matches("(?i)^(hi|hello|hey|good morning|good afternoon|good evening)\\b.*");
        List<String> words = Arrays.stream(question.toLowerCase(Locale.ROOT).split("[^a-z0-9]+"))
                .filter(word -> word.length() > 2)
                .filter(word -> !Set.of("the", "and", "for", "with", "what", "which", "how",
                        "can", "you", "are", "is", "my", "help", "please", "tell", "about").contains(word))
                .map(word -> word.endsWith("ies") ? word.substring(0, word.length() - 3) + "y"
                        : word.endsWith("s") ? word.substring(0, word.length() - 1) : word)
                .toList();

        List<Map<String, Object>> candidatePool = schemes;
        if (database.isConfigured()) {
            try {
                JsonNode remote = database.select("scholarships",
                        Map.of("verification_status", "in.(verified,outdated)",
                                "search_document", "websearch.q." + question, "limit", "10"),
                        "id,name,summary,application_status,application_end,official_url,information_source_url",
                        0, 9, false);
                if (remote != null && remote.isArray() && !remote.isEmpty()) {
                    candidatePool = json.convertValue(remote, new TypeReference<List<Map<String, Object>>>() {});
                }
            } catch (Exception ignored) {
                // The local catalog remains the fallback retrieval source.
            }
        }
        List<Map<String, Object>> picks = candidatePool.stream()
                .sorted(Comparator.comparingInt((Map<String, Object> s) -> score(s, words)).reversed())
                .filter(s -> greeting || score(s, words) > 0)
                .limit(3).toList();

        String answer;
        if (greeting) {
            answer = "Hi! I can help you explore scholarships. Tell me your education level, course, state, or student category, and I will look for relevant schemes in the catalog.";
        } else if (!picks.isEmpty()) {
            answer = "Here are relevant schemes from the local catalog:\n\n" + picks.stream()
                    .map(s -> "**" + s.get("name") + "**\n" + s.getOrDefault("summary", "")
                            + "\nApplication status: " + s.getOrDefault("application_status", "unknown")
                            + ". Deadline shown: " + s.getOrDefault("application_end", "not listed") + ".")
                    .collect(Collectors.joining("\n\n"))
                    + "\n\nCheck the official source for complete eligibility and current application details.";
        } else {
            answer = "I can help search the scholarship catalog. Try a scheme name, education level, course, state, or student category.";
        }

        if (!clean(nvidiaKey).isBlank() && !picks.isEmpty()) {
            try {
                List<Map<String, String>> references = picks.stream().map(s -> Map.of(
                        "name", string(s.get("name")),
                        "url", string(s.get("information_source_url"), string(s.get("official_url"))),
                        "summary", string(s.get("summary")))).toList();
                String context = json.writeValueAsString(references);
                JsonNode completion = http.post()
                        .uri("https://integrate.api.nvidia.com/v1/chat/completions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + clean(nvidiaKey))
                        .body(Map.of("model", clean(nvidiaModel), "temperature", 0.2, "max_tokens", 900,
                                "stream", false, "chat_template_kwargs", Map.of("enable_thinking", false),
                                "messages", List.of(
                                        Map.of("role", "system", "content", "Answer only from the scholarship records provided. Say when information is missing. Cite the official source URL for each recommendation."),
                                        Map.of("role", "user", "content", "Respond in " + body.getOrDefault("language", "English")
                                                + ". Question: " + question + "\nCatalog records: " + context))))
                        .retrieve().body(JsonNode.class);
                String liveAnswer = completion == null ? null : completion.at("/choices/0/message/content").asText(null);
                if (liveAnswer != null && !liveAnswer.isBlank()) {
                    List<Map<String, String>> sources = references.stream()
                            .map(s -> Map.of("name", s.get("name"), "url", s.get("url"))).toList();
                    return Map.of("answer", liveAnswer, "sources", sources, "mode", "nvidia");
                }
                System.err.println("NVIDIA response contained no message text; choices="
                        + (completion == null ? 0 : completion.path("choices").size())
                        + " contentType=" + (completion == null ? "missing"
                        : completion.at("/choices/0/message/content").getNodeType()));
            } catch (RestClientResponseException error) {
                System.err.println("NVIDIA assistant returned HTTP " + error.getStatusCode().value());
            } catch (Exception error) {
                System.err.println("NVIDIA assistant request failed: " + error.getClass().getSimpleName());
            }
        }
        return Map.of("answer", answer, "sources", List.of(), "mode", "local");
    }

    private Map<String, Object> searchSummary(Map<String, Object> scheme) {
        Map<String, Object> summary = new LinkedHashMap<>(scheme);
        for (String field : List.of("eligibility_rules", "required_documents", "application_procedure",
                "other_conditions", "annual_income_limit", "description")) {
            summary.remove(field);
        }
        return summary;
    }

    private Comparator<Map<String, Object>> comparator(String sort) {
        return switch (sort) {
            case "name" -> Comparator.comparing(s -> string(s.get("name")), String.CASE_INSENSITIVE_ORDER);
            case "amount" -> Comparator.comparingDouble((Map<String, Object> s) -> number(s.get("amount_max"))).reversed();
            case "updated" -> Comparator.comparing(s -> string(s.get("last_verified_at")), Comparator.reverseOrder());
            default -> Comparator.comparing(s -> string(s.get("application_end"), "9999"));
        };
    }

    private int score(Map<String, Object> scheme, List<String> words) {
        String text = searchableText(scheme);
        return (int) words.stream().filter(text::contains).count();
    }

    private String searchableText(Map<String, Object> scheme) {
        return (scheme.getOrDefault("name", "") + " " + scheme.getOrDefault("summary", "") + " "
                + scheme.getOrDefault("description", "") + " " + scheme.getOrDefault("category", "") + " "
                + scheme.getOrDefault("state_name", "") + " " + scheme.getOrDefault("education_levels", "") + " "
                + scheme.getOrDefault("eligible_courses", "") + " " + scheme.getOrDefault("target_categories", ""))
                .toString().toLowerCase(Locale.ROOT);
    }

    private boolean containsAllWords(String text, String query) {
        if (query == null || query.isBlank()) return true;
        return Arrays.stream(query.toLowerCase(Locale.ROOT).trim().split("\\s+"))
                .allMatch(text::contains);
    }

    private boolean equalsIfSet(Object value, String filter) {
        return filter == null || filter.isBlank() || filter.equals(value);
    }

    private boolean containsValue(Object values, String filter) {
        if (filter == null || filter.isBlank()) return true;
        if (!(values instanceof Collection<?> list)) return false;
        return list.stream().anyMatch(value -> filter.equals(value));
    }

    private boolean containsAnyText(Object values, String filter) {
        if (filter == null || filter.isBlank()) return true;
        if (!(values instanceof Collection<?> list)) return false;
        return list.stream().anyMatch(value -> string(value).toLowerCase(Locale.ROOT)
                .contains(filter.toLowerCase(Locale.ROOT)));
    }

    private String string(Object value) {
        return string(value, "");
    }

    private String string(Object value, String fallback) {
        return value == null ? fallback : value.toString();
    }

    private String clean(String value) {
        if (value == null) return "";
        String trimmed = value.trim();
        if (trimmed.length() >= 2 && ((trimmed.startsWith("\"") && trimmed.endsWith("\""))
                || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
            return trimmed.substring(1, trimmed.length() - 1).trim();
        }
        return trimmed;
    }

    private double number(Object value) {
        return value instanceof Number number ? number.doubleValue() : 0;
    }
}
