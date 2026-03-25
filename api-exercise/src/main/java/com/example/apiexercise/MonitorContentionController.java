package com.example.apiexercise;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MonitorContentionController {
  private final MonitorContentionLab monitorContentionLab;

  public MonitorContentionController(MonitorContentionLab monitorContentionLab) {
    this.monitorContentionLab = monitorContentionLab;
  }

  @PostMapping("/lock-lab/start")
  public Map<String, Object> start(
      @RequestParam(defaultValue = "200") int blockedThreads,
      @RequestParam(defaultValue = "60000") long holdMs) {
    return monitorContentionLab.start(blockedThreads, holdMs);
  }

  @GetMapping("/lock-lab/status")
  public Map<String, Object> status() {
    return monitorContentionLab.status();
  }

  @PostMapping("/lock-lab/reset")
  public Map<String, Object> reset() {
    return monitorContentionLab.reset();
  }
}
