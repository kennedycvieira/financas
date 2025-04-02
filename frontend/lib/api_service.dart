import 'dart:io';
import 'package:http/http.dart' as http;
import 'dart:convert';
class ApiService {
  //static const String baseUrl = 'http://10.0.2.2:3000/api'; // For Android emulator
  static late String baseUrl;// = 'http://localhost:3000/api';
  // Use 'http://localhost:3000/api' for web

  static void initializeBaseUrl() {
    try{
    if (Platform.isAndroid) {
      baseUrl = 'http://10.0.2.2:3000/api'; // For Android emulator
    } else if (Platform.isIOS) {
      baseUrl = 'http://localhost:3000/api'; // For iOS simulator
    } else {
      baseUrl = 'http://localhost:3000/api'; // For web or other platforms
    }}
        catch(e){//print("erro ao detectar plataforma");
    baseUrl = 'http://localhost:3000/api'; }
  }


  static Future<Map<String, dynamic>> register(String username, String email, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/register'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'username': username,
        'email': email,
        'password': password,
      }),
    );

    if (response.statusCode == 201) {
      return json.decode(response.body);
    } else {
      throw Exception(json.decode(response.body)['error'] ?? 'Failed to register');
    }
  }

  static Future<Map<String, dynamic>> login(String username, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/login'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'username': username,
        'password': password,
      }),
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception(json.decode(response.body)['error'] ?? 'Failed to login');
    }
  }

  static Future<List<dynamic>> getGroups(String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/groups'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load groups');
    }
  }

  static Future<Map<String, dynamic>> createGroup(String token, String name) async {
    final response = await http.post(
      Uri.parse('$baseUrl/groups'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({
        'name': name,
      }),
    );

    if (response.statusCode == 201) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to create group');
    }
  }

  static Future<List<dynamic>> getCategories(String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/categories'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load categories');
    }
  }

  static Future<Map<String, dynamic>> addExpense(
      String token,
      int groupId,
      double amount,
      String description,
      int categoryId,
      ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/expenses'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({
        'groupId': groupId,
        'amount': amount,
        'description': description,
        'categoryId': categoryId,
      }),
    );

    if (response.statusCode == 201) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to add expense');
    }
  }

  static Future<List<dynamic>> getExpenses(String token, int groupId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/groups/$groupId/expenses'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load expenses');
    }
  }

  static Future<Map<String, dynamic>> getSummary(String token, int groupId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/groups/$groupId/summary'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load summary');
    }
  }

  static Future<List<dynamic>> getCategorySummary(String token, int groupId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/groups/$groupId/categories'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load category summary');
    }
  }
  static Future<List<dynamic>> getReceivedInvites(String token, int userId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/users/$userId/receivedGroupInvites'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load invites');
    }
  }

  static Future<List<dynamic>> getSentInvites(String token, int userId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/users/$userId/sentGroupInvites'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load invites');
    }
  }

  static Future<void> sendInvite(String token, int userId, String receiverUsername, int groupId, String description) async {
    final response = await http.post(
      Uri.parse('$baseUrl/users/$userId/groupInvite'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({
        'receiverUsername': receiverUsername,
        'groupId': groupId,
        'description': description,
      }),
    );

    if (response.statusCode != 201) {
      throw Exception('Failed to send invite');
    }
  }

  static Future<void> acceptInvite(String token, int userId, int inviteId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/users/$userId/acceptGroupInvite'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({
        'inviteId': inviteId,
      }),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to accept invite');
    }
  }

  static Future<void> rejectInvite(String token, int userId, int inviteId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/users/$userId/rejectGroupInvite'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({
        'inviteId': inviteId,
      }),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to reject invite');
    }
  }

  static Future<void> revokeInvite(String token, int userId, int inviteId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/users/$userId/revokeGroupInvite'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({
        'inviteId': inviteId,
      }),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to revoke invite');
    }
  }
}
