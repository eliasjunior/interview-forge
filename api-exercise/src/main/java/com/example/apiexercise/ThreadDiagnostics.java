package com.example.apiexercise;

import java.lang.management.LockInfo;
import java.lang.management.ManagementFactory;
import java.lang.management.MonitorInfo;
import java.lang.management.ThreadInfo;
import java.lang.management.ThreadMXBean;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

public final class ThreadDiagnostics {
  private static final ThreadMXBean THREAD_MX_BEAN = ManagementFactory.getThreadMXBean();

  private ThreadDiagnostics() {
  }

  public static Map<String, Object> summarizeByCategory() {
    Map<String, Long> prefixGroups = new TreeMap<>();
    Map<String, Integer> categoryCounts = new LinkedHashMap<>();
    categoryCounts.put("jvm", 0);
    categoryCounts.put("framework", 0);
    categoryCounts.put("app", 0);

    Thread.getAllStackTraces().keySet().forEach(thread -> {
      String category = classify(thread.getName());
      categoryCounts.computeIfPresent(category, (key, value) -> value + 1);
      prefixGroups.merge(prefixOf(thread.getName()), 1L, Long::sum);
    });

    return Map.of(
        "capturedAt", Instant.now().toString(),
        "categoryCounts", categoryCounts,
        "prefixGroups", prefixGroups
    );
  }

  public static List<Map<String, Object>> dumpThreads() {
    ThreadInfo[] infos = THREAD_MX_BEAN.dumpAllThreads(true, true);
    List<Map<String, Object>> result = new ArrayList<>(infos.length);
    for (ThreadInfo info : infos) {
      LockInfo lockInfo = info.getLockInfo();
      MonitorInfo[] monitors = info.getLockedMonitors();
      result.add(Map.of(
          "name", info.getThreadName(),
          "state", String.valueOf(info.getThreadState()),
          "category", classify(info.getThreadName()),
          "lockName", info.getLockName() == null ? "" : info.getLockName(),
          "lockOwner", info.getLockOwnerName() == null ? "" : info.getLockOwnerName(),
          "waitingOn", lockInfo == null ? "" : lockInfo.toString(),
          "lockedMonitors", monitors.length,
          "topFrame", topFrame(info),
          "threadId", info.getThreadId()
      ));
    }
    result.sort(Comparator.comparing(entry -> entry.get("name").toString()));
    return result;
  }

  public static List<Map<String, Object>> compareBlockedHotspots(long delayMs) throws InterruptedException {
    ThreadInfo[] first = THREAD_MX_BEAN.dumpAllThreads(true, true);
    Thread.sleep(delayMs);
    ThreadInfo[] second = THREAD_MX_BEAN.dumpAllThreads(true, true);

    Map<String, String> firstBlocked = blockedFrames(first);
    Map<String, String> secondBlocked = blockedFrames(second);
    List<Map<String, Object>> hotspots = new ArrayList<>();
    for (Map.Entry<String, String> entry : secondBlocked.entrySet()) {
      String previousFrame = firstBlocked.get(entry.getKey());
      if (previousFrame != null && previousFrame.equals(entry.getValue())) {
        hotspots.add(Map.of(
            "thread", entry.getKey(),
            "state", "BLOCKED",
            "topFrame", entry.getValue(),
            "note", "Still BLOCKED in the same frame across both snapshots"
        ));
      }
    }
    hotspots.sort(Comparator.comparing(entry -> entry.get("thread").toString()));
    return hotspots;
  }

  private static Map<String, String> blockedFrames(ThreadInfo[] infos) {
    Map<String, String> blocked = new LinkedHashMap<>();
    for (ThreadInfo info : infos) {
      if (info.getThreadState() == Thread.State.BLOCKED) {
        blocked.put(info.getThreadName(), topFrame(info));
      }
    }
    return blocked;
  }

  private static String topFrame(ThreadInfo info) {
    StackTraceElement[] trace = info.getStackTrace();
    return trace.length == 0 ? "<no stack trace>" : trace[0].toString();
  }

  private static String prefixOf(String threadName) {
    int firstDash = threadName.indexOf('-');
    if (firstDash > 0) {
      return threadName.substring(0, firstDash + 1) + "*";
    }
    int firstSpace = threadName.indexOf(' ');
    if (firstSpace > 0) {
      return threadName.substring(0, firstSpace) + " *";
    }
    return threadName;
  }

  private static String classify(String threadName) {
    if (threadName.startsWith("http-nio-") || threadName.startsWith("Catalina-")) {
      return "framework";
    }
    if (threadName.startsWith("lab-worker-")
        || threadName.startsWith("lock-")
        || threadName.startsWith("main")) {
      return "app";
    }
    return "jvm";
  }
}
