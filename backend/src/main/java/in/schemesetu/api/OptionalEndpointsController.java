package in.schemesetu.api;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class OptionalEndpointsController {
    @PostMapping("/documents/analyze")
    Map<String, String> analyzeDocument() {
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Document storage is not configured.");
    }

    @DeleteMapping("/documents/{id}")
    Map<String, String> deleteDocument(@PathVariable String id) {
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Document storage is not configured.");
    }

    @DeleteMapping("/account")
    Map<String, String> deleteAccount() {
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Account service is not configured.");
    }

    @GetMapping({"/admin/overview", "/admin/scholarships"})
    Map<String, String> adminRead() {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Administrator access required.");
    }

    @PostMapping({"/admin/sources", "/admin/import", "/admin/embeddings/rebuild"})
    Map<String, String> adminCreate() {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Administrator access required.");
    }

    @PutMapping("/admin/scholarships/{id}")
    Map<String, String> adminUpdate(@PathVariable String id) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Administrator access required.");
    }

    @DeleteMapping("/admin/scholarships/{id}")
    Map<String, String> adminDelete(@PathVariable String id) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Administrator access required.");
    }

    @PatchMapping("/admin/scholarships/{id}/verification")
    Map<String, String> adminVerification(@PathVariable String id) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Administrator access required.");
    }

    @PostMapping("/admin/sources/{id}/check")
    Map<String, String> adminSourceCheck(@PathVariable String id) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Administrator access required.");
    }

    @GetMapping("/notifications")
    Map<String, String> notificationRead() {
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                "Sign in to view notifications.");
    }

    @PutMapping("/notifications/preferences")
    Map<String, String> notificationPreferences() {
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                "Sign in to update preferences.");
    }

    @PostMapping({"/notifications/schedule", "/notifications/push-subscription"})
    Map<String, String> notificationCreate() {
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                "Sign in to enable notifications.");
    }

    @PatchMapping("/notifications/{id}/read")
    Map<String, String> notificationMarkRead(@PathVariable String id) {
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                "Sign in required.");
    }
}
