// The game server core: model, engine, protocol and transport, with no Android dependencies.
// The Android module (app/modules/game-server) compiles these same sources; this build exists
// to run the unit tests on a plain JVM:  gradle test
plugins {
  kotlin("jvm") version "2.2.10"
}

repositories {
  mavenCentral()
}

dependencies {
  implementation("org.nanohttpd:nanohttpd:2.3.1")
  implementation("org.java-websocket:Java-WebSocket:1.6.0")
  // Android ships org.json; on a plain JVM it has to come from Maven.
  implementation("org.json:json:20240303")
  testImplementation(kotlin("test"))
}

tasks.test {
  useJUnitPlatform()
}

// Runs the server on this machine against the built web client, for development and end-to-end
// tests:  gradle devServer   (then open http://localhost:8080)
tasks.register<JavaExec>("devServer") {
  classpath = sourceSets["test"].runtimeClasspath
  mainClass.set("com.queaura.server.DevServerKt")
  args("../web/dist")
}
