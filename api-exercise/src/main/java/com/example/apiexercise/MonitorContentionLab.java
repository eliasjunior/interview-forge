package com.example.apiexercise;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;

@Component
public class MonitorContentionLab {
  private final Object hotMonitor = new Object();
  private final AtomicInteger runCounter = new AtomicInteger();
  private final List<Thread> blockerThreads = new ArrayList<>();
  private Thread ownerThread;
  private int currentRunId;
  private long holdMs;

  public synchronized Map<String, Object> start(int blockedThreads, long holdMs) {
    resetInternal();

    this.currentRunId = runCounter.incrementAndGet();
    this.holdMs = holdMs;

    ownerThread = new Thread(() -> {
      synchronized (hotMonitor) {
        try {
          Thread.sleep(holdMs);
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
        }
      }
    }, "lock-owner-run-" + currentRunId);
    ownerThread.start();

    waitForOwnerToGrabMonitor();

    for (int i = 0; i < blockedThreads; i++) {
      Thread blocker = new Thread(() -> {
        synchronized (hotMonitor) {
          // The thread becomes runnable only after the owner releases the monitor.
        }
      }, "lock-blocker-run-" + currentRunId + "-" + i);
      blocker.start();
      blockerThreads.add(blocker);
    }

    return status();
  }

  public synchronized Map<String, Object> status() {
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("capturedAt", Instant.now().toString());
    response.put("runId", currentRunId);
    response.put("holdMs", holdMs);
    response.put("ownerThread", ownerThread == null ? "" : ownerThread.getName());
    response.put("ownerState", ownerThread == null ? "" : String.valueOf(ownerThread.getState()));
    response.put("blockedThreadCount", blockerThreads.stream().filter(Thread::isAlive).count());
    response.put("sampleBlockers", blockerThreads.stream().limit(5).map(Thread::getName).toList());
    return response;
  }

  public synchronized Map<String, Object> reset() {
    resetInternal();
    return status();
  }

  private void waitForOwnerToGrabMonitor() {
    while (ownerThread != null && ownerThread.getState() == Thread.State.NEW) {
      Thread.onSpinWait();
    }
    try {
      Thread.sleep(50);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  private void resetInternal() {
    if (ownerThread != null) {
      ownerThread.interrupt();
    }
    for (Thread blocker : blockerThreads) {
      blocker.interrupt();
    }
    blockerThreads.clear();
    ownerThread = null;
    holdMs = 0;
  }
}
