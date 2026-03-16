import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;
import java.lang.management.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

public class Lab {
  static final Object LOCK = new Object();
  static final Object OUT_LOCK = new Object();
  static final Deque<String> OUT_LINES = new ArrayDeque<>();
  static final Set<Long> APP_THREAD_IDS = ConcurrentHashMap.newKeySet();
  static final int MAX_OUT_LINES = 2000;
  static volatile int submittedTasks = 0;

  public static void main(String[] args) throws Exception {
    installOutCapture();
    registerAppThread(Thread.currentThread());
    printBasics();
    HttpServer metricsServer = startMetricsServer();

    // Start with a few workers, then keep adding one thread every 5 seconds.
    List<Thread> contentionThreads = Collections.synchronizedList(new ArrayList<>());
    ScheduledExecutorService adder = Executors.newSingleThreadScheduledExecutor(r -> {
      Thread t = new Thread(r, "thread-adder");
      t.setDaemon(true);
      registerAppThread(t);
      return t;
    });
    for (int i = 0; i < 4; i++) {
      addContentionThread(contentionThreads);
    }
    adder.scheduleAtFixedRate(() -> addContentionThread(contentionThreads), 5, 5, TimeUnit.SECONDS);

    // 2) Allocate memory to trigger GC
    List<byte[]> trash = new ArrayList<>();
    for (int i = 0; i < 200; i++) {
      trash.add(new byte[1024 * 256]); // 256KB
      Thread.sleep(10);
    }

    print("\nApp running. PID=" + ProcessHandle.current().pid());
    print("Metrics endpoint: http://localhost:8080/metrics");
    print("D3 page file: java/threads/d3-demo/index.html");
    print("Adding one contention thread every 5 seconds.");
    print("Now take thread dumps / strace/jcmd from another terminal.");
    Thread.sleep(Duration.ofMinutes(10).toMillis());

    metricsServer.stop(0);
    adder.shutdownNow();
    synchronized (contentionThreads) {
      for (Thread t : contentionThreads) {
        t.interrupt();
      }
    }
  }

  static void printBasics() {
    Runtime rt = Runtime.getRuntime();
    print("PID: " + ProcessHandle.current().pid());
    print("CPUs: " + rt.availableProcessors());
    print("Heap max:   " + rt.maxMemory());
    print("Heap total: " + rt.totalMemory());
    print("Heap free:  " + rt.freeMemory());

    // JVM + OS view
    print("JVM: " + System.getProperty("java.vm.name") + " " + System.getProperty("java.version"));
    print("OS:  " + System.getProperty("os.name") + " " + System.getProperty("os.arch"));

    // Threads visible from Java (includes JVM internal threads)
    print("\nThreads at startup:");
    Thread.getAllStackTraces().keySet().stream()
        .map(Thread::getName).sorted()
        .forEach(n -> print(" - " + n));
  }

  static void busyWork(int ms) {
    long end = System.nanoTime() + ms * 1_000_000L;
    long x = 0;
    while (System.nanoTime() < end) {
      x ^= System.nanoTime();
    }
    if (x == 42) print("impossible");
  }

  static void addContentionThread(List<Thread> threads) {
    Thread worker = new Thread(() -> {
      while (!Thread.currentThread().isInterrupted()) {
        synchronized (LOCK) {
          busyWork(30); // CPU work while holding lock (bad on purpose)
        }
        try {
          Thread.sleep(20);
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
        }
      }
    }, "lab-worker-" + System.nanoTime());
    registerAppThread(worker);
    worker.start();
    threads.add(worker);
    submittedTasks++;
    print("Added thread: " + worker.getName() + " (total added: " + submittedTasks + ")");
  }

  static HttpServer startMetricsServer() throws Exception {
    HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);
    server.createContext("/metrics", Lab::handleMetrics);
    server.setExecutor(Executors.newSingleThreadExecutor(r -> {
      Thread t = new Thread(r, "metrics-http");
      t.setDaemon(true);
      registerAppThread(t);
      return t;
    }));
    server.start();
    return server;
  }

  static void handleMetrics(HttpExchange ex) throws java.io.IOException {
    Runtime rt = Runtime.getRuntime();
    ThreadMXBean tmx = ManagementFactory.getThreadMXBean();

    long heapUsed = rt.totalMemory() - rt.freeMemory();
    long heapMax = rt.maxMemory();
    int liveThreads = tmx.getThreadCount();
    int daemonThreads = tmx.getDaemonThreadCount();
    long totalStartedThreads = tmx.getTotalStartedThreadCount();
    List<String> outSnapshot;
    synchronized (OUT_LOCK) {
      outSnapshot = new ArrayList<>(OUT_LINES);
    }
    Set<Thread> allLiveThreads = Thread.getAllStackTraces().keySet();
    Set<Long> liveIds = new HashSet<>(allLiveThreads.size());
    List<String> appThreadNames = new ArrayList<>();
    List<String> jvmThreadNames = new ArrayList<>();
    for (Thread t : allLiveThreads) {
      liveIds.add(t.threadId());
      String label = t.getName() + " (id=" + t.threadId() + ")";
      if (APP_THREAD_IDS.contains(t.threadId())) {
        appThreadNames.add(label);
      } else {
        jvmThreadNames.add(label);
      }
    }
    appThreadNames.sort(String::compareTo);
    jvmThreadNames.sort(String::compareTo);
    APP_THREAD_IDS.retainAll(liveIds);

    StringBuilder json = new StringBuilder(1024);
    json.append("{\"timestamp\":").append(System.currentTimeMillis())
        .append(",\"heapUsed\":").append(heapUsed)
        .append(",\"heapMax\":").append(heapMax)
        .append(",\"liveThreads\":").append(liveThreads)
        .append(",\"daemonThreads\":").append(daemonThreads)
        .append(",\"totalStartedThreads\":").append(totalStartedThreads)
        .append(",\"submittedTasks\":").append(submittedTasks)
        .append(",\"appThreadCount\":").append(appThreadNames.size())
        .append(",\"jvmThreadCount\":").append(jvmThreadNames.size());
    json.append(",\"appThreadNames\":");
    appendJsonStringArray(json, appThreadNames);
    json.append(",\"jvmThreadNames\":");
    appendJsonStringArray(json, jvmThreadNames);
    json.append(",\"stdout\":");
    appendJsonStringArray(json, outSnapshot);
    json.append('}');

    byte[] body = json.toString().getBytes(StandardCharsets.UTF_8);
    ex.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
    ex.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
    ex.sendResponseHeaders(200, body.length);
    try (var os = ex.getResponseBody()) {
      os.write(body);
    }
  }

  static void installOutCapture() {
    PrintStream originalOut = System.out;
    OutputStream tee = new OutputStream() {
      final StringBuilder line = new StringBuilder();

      @Override
      public void write(int b) throws IOException {
        originalOut.write(b);
        if (b == '\n') {
          recordOutLine(line.toString());
          line.setLength(0);
        } else if (b != '\r') {
          line.append((char) b);
        }
      }

      @Override
      public void flush() throws IOException {
        originalOut.flush();
      }
    };
    System.setOut(new PrintStream(tee, true, StandardCharsets.UTF_8));
  }

  static void recordOutLine(String line) {
    synchronized (OUT_LOCK) {
      OUT_LINES.addLast(line);
      while (OUT_LINES.size() > MAX_OUT_LINES) {
        OUT_LINES.removeFirst();
      }
    }
  }

  static void print(String message) {
    System.out.println(message);
  }

  static void registerAppThread(Thread t) {
    APP_THREAD_IDS.add(t.threadId());
  }

  static void appendJsonStringArray(StringBuilder json, List<String> values) {
    json.append('[');
    for (int i = 0; i < values.size(); i++) {
      if (i > 0) json.append(',');
      json.append('"').append(jsonEscape(values.get(i))).append('"');
    }
    json.append(']');
  }

  static String jsonEscape(String s) {
    StringBuilder out = new StringBuilder(s.length() + 8);
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      switch (c) {
        case '\\' -> out.append("\\\\");
        case '"' -> out.append("\\\"");
        case '\b' -> out.append("\\b");
        case '\f' -> out.append("\\f");
        case '\n' -> out.append("\\n");
        case '\r' -> out.append("\\r");
        case '\t' -> out.append("\\t");
        default -> {
          if (c < 0x20) {
            out.append(String.format("\\u%04x", (int) c));
          } else {
            out.append(c);
          }
        }
      }
    }
    return out.toString();
  }
}
