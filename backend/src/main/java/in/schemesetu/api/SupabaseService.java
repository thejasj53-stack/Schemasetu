package in.schemesetu.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class SupabaseService {
    private final RestClient http = RestClient.create();
    private final ObjectMapper json;

    @Value("${SUPABASE_URL:}")
    private String url;

    @Value("${SUPABASE_SERVICE_ROLE_KEY:}")
    private String serviceKey;

    @Value("${SUPABASE_ANON_KEY:}")
    private String anonKey;

    public SupabaseService(ObjectMapper json) {
        this.json = json;
    }

    public boolean isConfigured() {
        return !url.isBlank() && (!serviceKey.isBlank() || !anonKey.isBlank());
    }

    public JsonNode select(String table, Map<String, String> filters, String columns,
                           Integer from, Integer to, boolean count) {
        Map<String, String> query = new LinkedHashMap<>();
        query.put("select", columns);
        if (filters != null) query.putAll(filters);
        Map<String, String> headers = new LinkedHashMap<>();
        if (from != null && to != null) headers.put("Range", from + "-" + to);
        if (count) headers.put("Prefer", "count=exact");
        return table(HttpMethod.GET, table, query, null, headers);
    }

    public JsonNode selectAll(String table, Map<String, String> filters, String columns, int batchSize) {
        ArrayNode all = JsonNodeFactory.instance.arrayNode();
        for (int offset = 0; ; offset += batchSize) {
            JsonNode page = select(table, filters, columns, offset, offset + batchSize - 1, false);
            if (page == null || !page.isArray()) break;
            all.addAll((ArrayNode) page);
            if (page.size() < batchSize) break;
        }
        return all;
    }

    public JsonNode table(HttpMethod method, String table, Map<String, String> query,
                          Object body, Map<String, String> extraHeaders) {
        RestClient.RequestBodySpec request = http.method(method).uri(uri(table, query))
                .header("apikey", key());
        addAuthorization(request, key());
        if (extraHeaders != null) extraHeaders.forEach(request::header);
        if (body != null) request.contentType(org.springframework.http.MediaType.APPLICATION_JSON).body(body);
        return request.retrieve().body(JsonNode.class);
    }

    public JsonNode user(String accessToken) {
        if (url.isBlank() || anonKey.isBlank()) return null;
        return http.get().uri(url.replaceAll("/$", "") + "/auth/v1/user")
                .header("apikey", anonKey).header("Authorization", "Bearer " + accessToken)
                .retrieve().body(JsonNode.class);
    }

    public boolean isAdmin(String userId) {
        JsonNode rows = select("admin_users", Map.of("user_id", "eq." + userId), "user_id,role", 0, 0, false);
        return rows != null && rows.isArray() && !rows.isEmpty();
    }

    public JsonNode deleteUser(String userId) {
        if (serviceKey.isBlank()) throw new IllegalStateException("Supabase service role key is not configured.");
        var request = http.delete().uri(url.replaceAll("/$", "") + "/auth/v1/admin/users/" + userId)
                .header("apikey", serviceKey);
        addAuthorization(request, serviceKey);
        return request.retrieve().body(JsonNode.class);
    }

    public byte[] download(String bucket, String path) {
        URI uri = UriComponentsBuilder.fromUriString(url.replaceAll("/$", ""))
                .path("/storage/v1/object/").path(bucket + "/").path(path).build().encode().toUri();
        var request = http.get().uri(uri).header("apikey", key());
        addAuthorization(request, key());
        return request.retrieve().body(byte[].class);
    }

    public void removeObjects(String bucket, List<String> paths) {
        if (serviceKey.isBlank()) throw new IllegalStateException("Supabase service role key is not configured.");
        var request = http.method(HttpMethod.DELETE).uri(url.replaceAll("/$", "") + "/storage/v1/object/" + bucket)
                .header("apikey", serviceKey);
        addAuthorization(request, serviceKey);
        request.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body(Map.of("prefixes", paths)).retrieve().toBodilessEntity();
    }

    public long count(String table, Map<String, String> filters) {
        Map<String, String> query = new LinkedHashMap<>();
        query.put("select", "*");
        if (filters != null) query.putAll(filters);
        var request = http.method(HttpMethod.HEAD).uri(uri(table, query))
                .header("apikey", key()).header("Prefer", "count=exact");
        addAuthorization(request, key());
        var response = request.retrieve().toBodilessEntity();
        String range = response.getHeaders().getFirst("Content-Range");
        if (range == null || !range.contains("/")) return 0;
        try {
            return Long.parseLong(range.substring(range.lastIndexOf('/') + 1));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    public Map<String, Object> asMap(JsonNode value) {
        return json.convertValue(value, json.getTypeFactory().constructMapType(Map.class, String.class, Object.class));
    }

    public String url() { return url; }

    public boolean hasServiceRole() { return !serviceKey.isBlank(); }

    private String key() { return serviceKey.isBlank() ? anonKey : serviceKey; }

    private void addAuthorization(RestClient.RequestHeadersSpec<?> request, String key) {
        if (key != null && key.startsWith("eyJ")) request.header("Authorization", "Bearer " + key);
    }

    private URI uri(String table, Map<String, String> query) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(url.replaceAll("/$", ""))
                .path("/rest/v1/").path(table);
        query.forEach(builder::queryParam);
        return builder.build().encode().toUri();
    }
}
