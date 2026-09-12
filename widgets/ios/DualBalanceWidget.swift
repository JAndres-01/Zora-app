//
//  DualBalanceWidget.swift
//  Zora · Widget #3A Dual Balance (Small 2x2)
//
//  WidgetKit SwiftUI Implementation for iOS Home Screen.
//  Reads shared metrics from App Group "group.com.zora.app"
//  and navigates to zora://tasks on tap.
//

import WidgetKit
import SwiftUI

// MARK: - Model & Entry
struct DualBalanceEntry: TimelineEntry {
    let date: Date
    let pendingCount: Int
    let completedCount: Int
    let totalCount: Int
    let completionRate: Int
    let dueTodayCount: Int
    
    static var placeholder: DualBalanceEntry {
        DualBalanceEntry(
            date: Date(),
            pendingCount: 5,
            completedCount: 14,
            totalCount: 19,
            completionRate: 74,
            dueTodayCount: 2
        )
    }
}

// MARK: - Timeline Provider
struct DualBalanceProvider: TimelineProvider {
    let appGroupId = "group.com.zora.app"
    let storageKey = "@zora_widget_dual_balance_data"

    func placeholder(in context: Context) -> DualBalanceEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (DualBalanceEntry) -> Void) {
        completion(readSharedData() ?? .placeholder)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DualBalanceEntry>) -> Void) {
        let entry = readSharedData() ?? .placeholder
        // Actualizar cada 15 minutos o cuando la app escriba nuevos datos
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func readSharedData() -> DualBalanceEntry? {
        guard let userDefaults = UserDefaults(suiteName: appGroupId),
              let jsonString = userDefaults.string(forKey: storageKey),
              let jsonData = jsonString.data(using: .utf8) else {
            return nil
        }

        struct RawWidgetData: Codable {
            let pendingCount: Int
            let completedCount: Int
            let totalCount: Int
            let completionRate: Int
            let dueTodayCount: Int
        }

        do {
            let raw = try JSONDecoder().decode(RawWidgetData.self, from: jsonData)
            return DualBalanceEntry(
                date: Date(),
                pendingCount: raw.pendingCount,
                completedCount: raw.completedCount,
                totalCount: raw.totalCount,
                completionRate: raw.completionRate,
                dueTodayCount: raw.dueTodayCount
            )
        } catch {
            return nil
        }
    }
}

// MARK: - SwiftUI View
struct DualBalanceWidgetView: View {
    var entry: DualBalanceEntry

    // Colores de la paleta Zora Minimalist Dark
    private let bgCard = Color(red: 18/255, green: 18/255, blue: 21/255) // #121215
    private let emeraldAccent = Color(red: 16/255, green: 185/255, blue: 129/255) // #10B981
    private let textMuted = Color(red: 113/255, green: 113/255, blue: 122/255) // #71717A
    private let textSub = Color(red: 161/255, green: 161/255, blue: 170/255) // #A1A1AA
    private let barBg = Color(red: 39/255, green: 39/255, blue: 42/255) // #27272A
    private let barRemaining = Color(red: 63/255, green: 63/255, blue: 70/255) // #3F3F46

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Encabezado con amplio respiro
            HStack(spacing: 8) {
                Text("BALANCE GENERAL")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(textSub)
                    .tracking(0.3)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Spacer()
                Text("\(entry.completionRate)%")
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundColor(emeraldAccent)
            }
            .padding(.bottom, 6)

            Spacer()

            // Columnas Métricas Duales equilibradas
            HStack(alignment: .center, spacing: 4) {
                // Pendientes
                VStack(spacing: 3) {
                    Text("\(entry.pendingCount)")
                        .font(.system(size: 28, weight: .heavy, design: .rounded))
                        .foregroundColor(.white)
                    Text("PENDIENTES")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(textMuted)
                        .tracking(0.2)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }
                .frame(maxWidth: .infinity)

                // Separador vertical
                Rectangle()
                    .fill(Color.white.opacity(0.08))
                    .frame(width: 1, height: 26)

                // Entregadas
                VStack(spacing: 3) {
                    Text("\(entry.completedCount)")
                        .font(.system(size: 28, weight: .heavy, design: .rounded))
                        .foregroundColor(emeraldAccent)
                    Text("ENTREGADAS")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(textMuted)
                        .tracking(0.2)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }
                .frame(maxWidth: .infinity)
            }

            Spacer()

            // Footer con Total, Entregas Hoy y Barra Proporcional
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text("\(entry.totalCount) \(entry.totalCount == 1 ? "tarea" : "tareas")")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundColor(textMuted)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    Spacer()
                    Text(entry.dueTodayCount > 0 ? "\(entry.dueTodayCount) para hoy" : (entry.pendingCount == 0 && entry.totalCount > 0 ? "¡Todo listo!" : "0 para hoy"))
                        .font(.system(size: 9, weight: .medium))
                        .foregroundColor(textMuted)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }

                // Barra de progreso segmentada
                GeometryReader { geo in
                    let clampedRate = max(0.0, min(1.0, Double(entry.completionRate) / 100.0))
                    HStack(spacing: 0) {
                        Rectangle()
                            .fill(emeraldAccent)
                            .frame(width: geo.size.width * CGFloat(clampedRate))
                        Rectangle()
                            .fill(barRemaining)
                            .frame(width: geo.size.width * CGFloat(1.0 - clampedRate))
                    }
                    .frame(height: 4.5)
                    .background(barBg)
                    .cornerRadius(2.25)
                }
                .frame(height: 4.5)
            }
        }
        .padding(13)
        .background(bgCard)
        // Redirección directa al pulsar el widget en la pantalla de inicio de iOS
        .widgetURL(URL(string: "zora://tasks"))
    }
}

// MARK: - Widget Configuration
@main
struct DualBalanceWidget: Widget {
    let kind: String = "DualBalanceWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DualBalanceProvider()) { entry in
            DualBalanceWidgetView(entry: entry)
        }
        .configurationDisplayName("Balance de Tareas")
        .description("Visualiza tus tareas pendientes y entregadas con porcentaje de cumplimiento.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}
