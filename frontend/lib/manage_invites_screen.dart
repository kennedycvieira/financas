import 'package:flutter/material.dart';
//import 'package:http/http.dart' as http;
//import 'dart:convert';
import 'auth_provider.dart';
import 'api_service.dart';


class ManageInvitesScreen extends StatefulWidget {
  final int groupId;

  const ManageInvitesScreen({required this.groupId, super.key});

  @override
  _ManageInvitesScreenState createState() => _ManageInvitesScreenState();
}

class _ManageInvitesScreenState extends State<ManageInvitesScreen> {
  final TextEditingController _usernameController = TextEditingController();
  List<dynamic> _sentInvites = [];
  bool _isLoading = true;
  String? _token;
  int? _userId;

  @override
  void initState() {
    super.initState();
    _loadSentInvites();
  }

  Future<void> _loadSentInvites() async {
    setState(() => _isLoading = true);
    try {
      _token = await AuthProvider.getToken();
      final user = await AuthProvider.getUser();
      _userId = user?['id'];
      if (_token != null && _userId != null) {
        final invites = await ApiService.getSentInvites(_token!, _userId!);
        setState(() => _sentInvites = invites);
      }
    } catch (e) {
      // Handle error
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _sendInvite() async {
    if (_usernameController.text.isNotEmpty) {
      setState(() => _isLoading = true);
      try {
        await ApiService.sendInvite(
          _token!,
          _userId!,
          _usernameController.text,
          widget.groupId,
          'Join my group',
        );
        _loadSentInvites();
      } catch (e) {
        // Handle error
      } finally {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _revokeInvite(int inviteId) async {
    try {
      await ApiService.revokeInvite(_token!, _userId!, inviteId);
      _loadSentInvites();
    } catch (e) {
      // Handle error
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Manage Invites'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _usernameController,
                decoration: const InputDecoration(
                  labelText: 'Username',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _sendInvite,
                child: const Text('Send Invite'),
              ),
              const SizedBox(height: 24),
              const Text(
                'Sent Invites',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              ..._sentInvites.map((invite) => Card(
                margin: const EdgeInsets.symmetric(vertical: 4),
                child: ListTile(
                  title: Text('To: ${invite['receiver_username']}'),
                  subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Description:'+invite['description']),
                      Text('Group: ${invite['group_name']}'),
                      Text('Status: ${invite['status']}')
                    ],),
                  trailing: IconButton(
                    icon: const Icon(Icons.cancel, color: Colors.red),
                    onPressed: () => _revokeInvite(invite['id']),
                  ),
                ),
              )),
            ],
          ),
        ),
      ),
    );
  }
}