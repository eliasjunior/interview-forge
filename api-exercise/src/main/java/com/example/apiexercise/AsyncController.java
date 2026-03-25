package com.example.apiexercise;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.DeferredResult;
import org.springframework.web.context.request.async.WebAsyncTask;

@RestController
public class AsyncController {
  private final AsyncTaskExecutor labExecutor;

  public AsyncController(@Qualifier("labExecutor") AsyncTaskExecutor labExecutor) {
    this.labExecutor = labExecutor;
  }

  @GetMapping("/sync/sleep")
  public Map<String, Object> syncSleep(@RequestParam(defaultValue = "5000") long ms) throws InterruptedException {
    String requestThread = Thread.currentThread().getName();
    Thread.sleep(ms);
    return payload("sync", requestThread, Thread.currentThread().getName(), ms);
  }

  @GetMapping("/async/future")
  public CompletableFuture<Map<String, Object>> future(@RequestParam(defaultValue = "5000") long ms) {
    String requestThread = Thread.currentThread().getName();
    return CompletableFuture.supplyAsync(() -> {
      sleep(ms);
      return payload("completableFuture", requestThread, Thread.currentThread().getName(), ms);
    }, labExecutor);
  }

  @GetMapping("/async/deferred")
  public DeferredResult<Map<String, Object>> deferred(@RequestParam(defaultValue = "5000") long ms) {
    String requestThread = Thread.currentThread().getName();
    DeferredResult<Map<String, Object>> result = new DeferredResult<>(30_000L);
    labExecutor.execute(() -> {
      sleep(ms);
      result.setResult(payload("deferredResult", requestThread, Thread.currentThread().getName(), ms));
    });
    return result;
  }

  @GetMapping("/async/web-task")
  public WebAsyncTask<Map<String, Object>> webAsyncTask(@RequestParam(defaultValue = "5000") long ms) {
    String requestThread = Thread.currentThread().getName();
    return new WebAsyncTask<Map<String, Object>>(30_000L, labExecutor, () -> {
      sleep(ms);
      return payload("webAsyncTask", requestThread, Thread.currentThread().getName(), ms);
    });
  }

  @GetMapping("/thread")
  public Map<String, Object> thread() {
    return Map.of(
        "now", Instant.now().toString(),
        "thread", Thread.currentThread().getName()
    );
  }

  private static Map<String, Object> payload(String mode, String requestThread, String workerThread, long ms) {
    return Map.of(
        "mode", mode,
        "sleptMs", ms,
        "requestThread", requestThread,
        "workerThread", workerThread,
        "completedAt", Instant.now().toString()
    );
  }

  private static void sleep(long ms) {
    try {
      Thread.sleep(ms);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted during simulated work", e);
    }
  }
}
