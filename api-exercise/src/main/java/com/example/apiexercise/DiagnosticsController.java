package com.example.apiexercise;

import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DiagnosticsController {
  @GetMapping("/diagnostics/summary")
  public Map<String, Object> summary() {
    return ThreadDiagnostics.summarizeByCategory();
  }

  @GetMapping("/diagnostics/threads")
  public List<Map<String, Object>> threads() {
    return ThreadDiagnostics.dumpThreads();
  }

  @GetMapping("/diagnostics/hotspots")
  public List<Map<String, Object>> hotspots(@RequestParam(defaultValue = "10000") long delayMs)
      throws InterruptedException {
    return ThreadDiagnostics.compareBlockedHotspots(delayMs);
  }
}
