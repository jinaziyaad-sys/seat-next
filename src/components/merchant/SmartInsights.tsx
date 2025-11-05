import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, TrendingUp, TrendingDown, Info, CheckCircle, Users, Clock } from "lucide-react";

interface InsightData {
  orderMetrics?: {
    avgPrepTime?: number;
    onTimeRate?: number;
    totalOrders?: number;
  };
  customerMetrics?: {
    returnRate?: number;
    atRiskCustomers?: number;
    totalCustomers?: number;
    newCustomers?: number;
    activeCustomers?: number;
  };
  efficiencyMetrics?: {
    avgWaitTime?: number;
    peakHours?: Array<{ hour: number; count: number }>;
    onTimePerformanceByHour?: Array<{ hour: number; rate: number }>;
  };
  comparativeData?: {
    currentValue: number;
    previousValue: number;
    metricName: string;
  };
}

interface SmartInsightsProps {
  data: InsightData;
  type: "orders" | "customers" | "operations" | "overview";
}

interface Insight {
  type: "success" | "warning" | "info" | "error";
  title: string;
  message: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SmartInsights = ({ data, type }: SmartInsightsProps) => {
  const generateInsights = (): Insight[] => {
    const insights: Insight[] = [];

    // Order Performance Insights
    if (type === "orders" || type === "overview") {
      if (data.orderMetrics) {
        const { avgPrepTime, onTimeRate, totalOrders } = data.orderMetrics;

        // On-time performance
        if (onTimeRate !== undefined) {
          if (onTimeRate < 70) {
            insights.push({
              type: "error",
              title: "Low On-Time Performance",
              message: `Only ${onTimeRate.toFixed(1)}% of orders are ready on time. Review kitchen workflows and consider adjusting quoted times to improve customer satisfaction.`,
              icon: AlertTriangle,
            });
          } else if (onTimeRate < 85) {
            insights.push({
              type: "warning",
              title: "On-Time Performance Needs Improvement",
              message: `Current on-time rate is ${onTimeRate.toFixed(1)}%. Aim for 90%+ by optimizing prep times during peak hours and ensuring adequate staffing.`,
              icon: TrendingUp,
            });
          } else if (onTimeRate >= 95) {
            insights.push({
              type: "success",
              title: "Excellent On-Time Performance",
              message: `Outstanding ${onTimeRate.toFixed(1)}% on-time rate! Your team is consistently meeting customer expectations.`,
              icon: CheckCircle,
            });
          }
        }

        // Prep time analysis
        if (avgPrepTime !== undefined) {
          if (avgPrepTime > 25) {
            insights.push({
              type: "warning",
              title: "High Average Prep Time",
              message: `Average prep time of ${avgPrepTime.toFixed(0)} minutes is above optimal. Consider streamlining kitchen processes or menu simplification.`,
              icon: Clock,
            });
          } else if (avgPrepTime < 10) {
            insights.push({
              type: "info",
              title: "Fast Prep Times",
              message: `Your ${avgPrepTime.toFixed(0)}-minute average prep time is excellent. Ensure quality isn't compromised for speed.`,
              icon: TrendingUp,
            });
          }
        }

        // Volume insights
        if (totalOrders !== undefined && totalOrders < 10) {
          insights.push({
            type: "info",
            title: "Limited Data Available",
            message: "More order data is needed for accurate insights. Insights will improve as you process more orders.",
            icon: Info,
          });
        }
      }
    }

    // Customer Retention Insights
    if (type === "customers" || type === "overview") {
      if (data.customerMetrics) {
        const { returnRate, atRiskCustomers, totalCustomers, newCustomers, activeCustomers } = data.customerMetrics;

        // Return rate analysis
        if (returnRate !== undefined) {
          if (returnRate < 30) {
            insights.push({
              type: "error",
              title: "Low Customer Retention",
              message: `Only ${returnRate.toFixed(1)}% of customers return. Implement loyalty programs, follow-up campaigns, or special offers to boost retention.`,
              icon: AlertTriangle,
            });
          } else if (returnRate < 50) {
            insights.push({
              type: "warning",
              title: "Customer Retention Opportunity",
              message: `${returnRate.toFixed(1)}% return rate shows room for improvement. Consider personalized offers or a loyalty program to increase repeat visits.`,
              icon: Users,
            });
          } else if (returnRate >= 70) {
            insights.push({
              type: "success",
              title: "Strong Customer Loyalty",
              message: `Excellent ${returnRate.toFixed(1)}% return rate! Your customers love coming back. Keep up the great service.`,
              icon: CheckCircle,
            });
          }
        }

        // At-risk customers
        if (atRiskCustomers !== undefined && atRiskCustomers > 0) {
          const percentage = totalCustomers ? (atRiskCustomers / totalCustomers * 100).toFixed(0) : 0;
          insights.push({
            type: "warning",
            title: "At-Risk Customers Detected",
            message: `${atRiskCustomers} customers (${percentage}%) haven't visited in 30-60 days. Send them a special offer or reminder to re-engage them.`,
            icon: AlertTriangle,
          });
        }

        // New vs Active balance
        if (newCustomers !== undefined && activeCustomers !== undefined && totalCustomers) {
          const newPercentage = (newCustomers / totalCustomers) * 100;
          const activePercentage = (activeCustomers / totalCustomers) * 100;

          if (newPercentage > 70) {
            insights.push({
              type: "info",
              title: "High New Customer Ratio",
              message: `${newPercentage.toFixed(0)}% of your customers are new. Focus on retention strategies to convert them into regulars.`,
              icon: Users,
            });
          } else if (activePercentage > 60) {
            insights.push({
              type: "success",
              title: "Strong Active Customer Base",
              message: `${activePercentage.toFixed(0)}% of customers are actively engaged. Your retention efforts are working well!`,
              icon: CheckCircle,
            });
          }
        }
      }
    }

    // Operational Efficiency Insights
    if (type === "operations" || type === "overview") {
      if (data.efficiencyMetrics) {
        const { avgWaitTime, peakHours, onTimePerformanceByHour } = data.efficiencyMetrics;

        // Wait time analysis
        if (avgWaitTime !== undefined) {
          if (avgWaitTime > 30) {
            insights.push({
              type: "error",
              title: "Long Wait Times",
              message: `Average ${avgWaitTime.toFixed(0)}-minute wait time may frustrate customers. Optimize table turnover or consider a reservation system.`,
              icon: Clock,
            });
          } else if (avgWaitTime > 20) {
            insights.push({
              type: "warning",
              title: "Wait Time Optimization Needed",
              message: `${avgWaitTime.toFixed(0)}-minute average wait. Consider staffing adjustments during peak hours to reduce wait times.`,
              icon: TrendingUp,
            });
          }
        }

        // Peak hour staffing
        if (peakHours && peakHours.length > 0) {
          const peakHour = peakHours[0];
          const hourFormatted = peakHour.hour % 12 || 12;
          const ampm = peakHour.hour >= 12 ? 'PM' : 'AM';
          
          insights.push({
            type: "info",
            title: "Peak Hour Identified",
            message: `Your busiest hour is ${hourFormatted}${ampm} with ${peakHour.count} orders. Ensure adequate staffing during this time to maintain service quality.`,
            icon: TrendingUp,
          });
        }

        // Hourly performance variation
        if (onTimePerformanceByHour && onTimePerformanceByHour.length > 0) {
          const lowPerformanceHours = onTimePerformanceByHour.filter(h => h.rate < 75);
          if (lowPerformanceHours.length > 0) {
            const hours = lowPerformanceHours.map(h => {
              const hour12 = h.hour % 12 || 12;
              return `${hour12}${h.hour >= 12 ? 'PM' : 'AM'}`;
            }).join(', ');
            
            insights.push({
              type: "warning",
              title: "Performance Dips Detected",
              message: `On-time performance drops during ${hours}. Review staffing levels and kitchen capacity during these hours.`,
              icon: TrendingDown,
            });
          }
        }
      }
    }

    // Comparative Trend Insights
    if (data.comparativeData) {
      const { currentValue, previousValue, metricName } = data.comparativeData;
      const percentChange = ((currentValue - previousValue) / previousValue) * 100;

      if (Math.abs(percentChange) > 20) {
        const isPositive = percentChange > 0;
        const direction = isPositive ? "increased" : "decreased";
        
        insights.push({
          type: Math.abs(percentChange) > 30 ? "warning" : "info",
          title: `Significant ${metricName} Change`,
          message: `${metricName} has ${direction} by ${Math.abs(percentChange).toFixed(0)}% compared to the previous period. ${isPositive ? "Investigate what's driving this growth." : "Review recent changes that may have impacted performance."}`,
          icon: isPositive ? TrendingUp : TrendingDown,
        });
      }
    }

    return insights;
  };

  const insights = generateInsights();

  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {insights.map((insight, index) => {
        const Icon = insight.icon;
        return (
          <Alert key={index} variant={insight.type === "error" || insight.type === "warning" ? "destructive" : "default"}>
            <Icon className="h-4 w-4" />
            <AlertTitle>{insight.title}</AlertTitle>
            <AlertDescription>{insight.message}</AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
};
